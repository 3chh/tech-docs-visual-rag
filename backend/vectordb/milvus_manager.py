"""Milvus backend — hỗ trợ cả chế độ lite (file cục bộ) và standalone."""

import concurrent.futures

import numpy as np
from pymilvus import DataType, MilvusClient

from ..core.logging import get_logger
from .base import BaseVectorManager

logger = get_logger(__name__)


class MilvusManager(BaseVectorManager):
    def __init__(self, type, milvus_uri, token, database_name, vector_collection_name, metadata_collection_name, create_collection, search_limit, doc_dim, dim=128):
        self.type = type
        self.client = MilvusClient(uri=milvus_uri, token=token)
        self.search_limit = search_limit
        self.doc_dim = doc_dim
        if database_name is not None:
            try:
                self.client.create_database(database_name)
            except Exception as e:
                if "database already exist" not in str(e):
                    raise
            self.client.using_database(database_name)
        else:
            logger.info("Dùng Milvus Lite (không có database_name)")
            pass
        self.vector_collection_name = vector_collection_name
        if self.client.has_collection(collection_name=self.vector_collection_name):
            self.client.load_collection(collection_name=self.vector_collection_name)
        self.metadata_collection_name = metadata_collection_name
        if self.client.has_collection(collection_name=self.metadata_collection_name):
            self.client.load_collection(collection_name=self.metadata_collection_name)
        self.dim = dim

        if create_collection:
            self.create_vector_collection()
            self.create_metadata_collection()


    def create_vector_collection(self):
        if self.client.has_collection(collection_name=self.vector_collection_name):
            self.client.drop_collection(collection_name=self.vector_collection_name)
        schema = self.client.create_schema(
            auto_id=True,
            enable_dynamic_fields=True,
        )
        schema.add_field(field_name="pk", datatype=DataType.INT64, is_primary=True)
        schema.add_field(
            field_name="vector", datatype=DataType.FLOAT_VECTOR, dim=self.dim
        )
        # schema.add_field(field_name="seq_id", datatype=DataType.INT16)
        schema.add_field(field_name="chunk_id", datatype=DataType.INT64)
        # schema.add_field(field_name="source_doc_id", datatype=DataType.VARCHAR, max_length=2048)

        self.client.create_collection(
            collection_name=self.vector_collection_name, schema=schema
        )

        index_params = self.client.prepare_index_params()
        index_params.add_index(
            field_name="vector",
            index_name="vector_index",
            index_type="IVF_FLAT", 
            metric_type="IP", 
            params={
                "M": 16,
                "efConstruction": 500,
            },
        )

        self.client.create_index(
            collection_name=self.vector_collection_name, index_params=index_params, sync=True
        )

        scalar_index_params = self.client.prepare_index_params()
        scalar_index_params.add_index(field_name="chunk_id", index_type="INVERTED")
        # scalar_index_params.add_index(field_name="source_doc_id", index_type="INVERTED")
        self.client.create_index(
            collection_name=self.vector_collection_name, index_params=scalar_index_params, sync=True
        )

    def create_metadata_collection(self):
        if self.client.has_collection(collection_name=self.metadata_collection_name):
            self.client.drop_collection(collection_name=self.metadata_collection_name)
        schema = self.client.create_schema(
            auto_id=True,
            enable_dynamic_fields=True,
        )
        schema.add_field(field_name="pk", datatype=DataType.INT64, is_primary=True)
        schema.add_field(field_name="chunk_id", datatype=DataType.INT64)
        # schema.add_field(field_name="source_doc_id", datatype=DataType.VARCHAR, max_length=512)
        # schema.add_field(field_name="content_type", datatype=DataType.VARCHAR, max_length=64)
        schema.add_field(field_name="section_title", datatype=DataType.VARCHAR, max_length=1024)
        schema.add_field(field_name="section_pages", datatype=DataType.ARRAY, element_type=DataType.VARCHAR, max_capacity=100, max_length=20)
        schema.add_field(field_name="ancestors", datatype=DataType.ARRAY, element_type=DataType.VARCHAR, max_capacity=100, max_length=1024)
        schema.add_field(field_name="formulas", datatype=DataType.JSON)
        schema.add_field(field_name="image_path", datatype=DataType.VARCHAR, max_length=512)

        self.client.create_collection(
            collection_name=self.metadata_collection_name, schema=schema
        )

        scalar_index_params = self.client.prepare_index_params()
        scalar_index_params.add_index(field_name="chunk_id", index_type="INVERTED")
        # scalar_index_params.add_index(field_name="source_doc_id", index_type="INVERTED")
        # scalar_index_params.add_index(field_name="content_type", index_type="INVERTED")
        # scalar_index_params.add_index(field_name="section_title", index_type="INVERTED")
        # scalar_index_params.add_index(field_name="section_pages", index_type="INVERTED")
        # scalar_index_params.add_index(field_name="ancestors", index_type="INVERTED")
        # scalar_index_params.add_index(field_name="formulas", index_type="INVERTED")
        # scalar_index_params.add_index(field_name="image_path", index_type="INVERTED")
        self.client.create_index(
            collection_name=self.metadata_collection_name, index_params=scalar_index_params, sync=True
        )

    def search(self, data, topk):
        # Stage 1: Candidate Retrieval (same as before)
        search_params = {
            "metric_type": "IP", 
            "params": {
                "ef": 128 # Search scope at query time for HNSW, tune this for recall/performance
            }
        }
        logger.info("Search topk=%d", topk)
        logger.debug("Query vector shape: %s", data.shape)
        results = self.client.search(
            self.vector_collection_name,
            data,
            limit=topk * 5,
            output_fields=["chunk_id"], # We only need chunk_id here
            search_params=search_params,
            # filter=filter_experession   # Optional: Add filter expression if needed
        )

        # Get unique candidate chunk_ids
        if not results:
            return []

        candidate_chunk_ids = list(set(hit["entity"]["chunk_id"] for qres in results for hit in qres))
        logger.debug("Số candidate_chunk_ids: %d", len(candidate_chunk_ids))
        if not candidate_chunk_ids:
            return []

        # Stage 2: Efficient Reranking
        num_doc_per_query = self.search_limit // self.doc_dim

        # if self.search_limit is not None:
        #     num_doc_per_query = self.search_limit // self.doc_dim
        # else:
        #     num_doc_per_query = 10000
        # # Fetch all vectors for all candidate documents in parallel with num_doc_per_query
        # if self.type == "lite":
        #     all_doc_vecs_entities = []
        #     for i in range(0, len(candidate_chunk_ids), num_doc_per_query):
        #         chunk_ids = candidate_chunk_ids[i:i+num_doc_per_query]
        #         all_doc_vecs_entities.extend(self.client.query(self.vector_collection_name, f"chunk_id in [{', '.join(map(str, chunk_ids))}]", output_fields=["chunk_id", "vector"]))
        # else:
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = []
            for i in range(0, len(candidate_chunk_ids), num_doc_per_query):
                chunk_ids = candidate_chunk_ids[i:i+num_doc_per_query]
                futures.append(executor.submit(self.client.query, self.vector_collection_name, f"chunk_id in [{', '.join(map(str, chunk_ids))}]", output_fields=["chunk_id", "vector"]))

            all_doc_vecs_entities = []
            for future in concurrent.futures.as_completed(futures):
                all_doc_vecs_entities.extend(future.result())
        

        # Group vectors by chunk_id in-memory
        vectors_by_chunk_id = {}
        for entity in all_doc_vecs_entities:
            chunk_id = entity["chunk_id"]
            if chunk_id not in vectors_by_chunk_id:
                vectors_by_chunk_id[chunk_id] = []
            vectors_by_chunk_id[chunk_id].append(entity["vector"])

        # Perform reranking (no thread pool needed, it's fast now)
        scores = []
        for chunk_id, vecs in vectors_by_chunk_id.items():
            chunk_vecs_matrix = np.vstack(vecs)
            # MaxSim calculation
            score = np.dot(data, chunk_vecs_matrix.T).max(1).sum()
            scores.append((score, chunk_id))

        scores.sort(key=lambda x: x[0], reverse=True)

        final_ranked_ids = [chunk_id for _, chunk_id in scores[:topk]]

        if not final_ranked_ids:
            return []
        
        # Stage 3: Fetch Metadata for Final Ranked IDs
        # if self.type == "lite":
        #     hydrated_results = []
        #     for i in range(0, len(final_ranked_ids), num_doc_per_query):
        #         chunk_ids = final_ranked_ids[i:i+num_doc_per_query]
        #         hydrated_results.extend(self.client.query(self.metadata_collection_name, f"chunk_id in [{', '.join(map(str, chunk_ids))}]", output_fields=["*"]))
        # else:
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            futures = []
            for i in range(0, len(final_ranked_ids), num_doc_per_query):
                chunk_ids = final_ranked_ids[i:i+num_doc_per_query]
                futures.append(executor.submit(self.client.query, self.metadata_collection_name, f"chunk_id in [{', '.join(map(str, chunk_ids))}]", output_fields=["*"]))

            hydrated_results = []
            for future in concurrent.futures.as_completed(futures):
                hydrated_results.extend(future.result())


        results_map = {entity["chunk_id"]: entity for entity in hydrated_results}
        final_ordered_results = [results_map[chunk_id] for chunk_id in final_ranked_ids if chunk_id in results_map]
        return final_ordered_results


    def insert_chunks(self, chunks: list):
        """
        Inserts structured data into the two-collection system.
        This is the main insertion method to be called from your middleware.
        """
        if not chunks:
            return

        metadata_entities = []
        vector_entities = []

        for i, chunk in enumerate(chunks):
            # Assign a unique chunk_id. Here we use source_doc_id and index to create it.
            # A more robust method could be a hash of the content.
            # For simplicity, let's use a combination of a timestamp/hash and index.
            # For this example, let's assume the calling function provides a unique 'chunk_id'.
            # chunk_id = chunk.get("chunk_id")
            # if chunk_id is None:
            #     raise ValueError("Each chunk must have a unique 'chunk_id'.")

            # Prepare the single metadata entry
            # metadata = chunk.get("metadata", {})
            metadata_entities.append({
                "chunk_id": i,
                # "source_doc_id": i,
                "section_title": chunk.get("section_title", ""),
                "section_pages": chunk.get("section_pages", []),
                "ancestors": chunk.get("ancestors", []),
                "formulas": chunk.get("formulas", {}),
                "image_path": chunk.get("image_path", ""),
                "metadata": chunk.get("metadata", "")
            })

            # Prepare the multiple vector entries
            for vec in chunk.get("colbert_vecs", []):
                vector_entities.append({
                    "chunk_id": i,
                    # "source_doc_id": source_doc_id,
                    "vector": vec
                })

        # Insert into collections
        if metadata_entities:
            self.client.insert(self.metadata_collection_name, metadata_entities)
            logger.info("Đã ghi %d bản ghi metadata", len(metadata_entities))
        
        if vector_entities:
            self.client.insert(self.vector_collection_name, vector_entities)
            logger.info("Đã ghi %d bản ghi vector", len(vector_entities))

    def get_chunk_metadata(self, chunk_ids: list):
        """
        A utility function to retrieve metadata for a given list of chunk IDs.
        """
        if not chunk_ids:
            return []

        return self.client.query(
            collection_name=self.metadata_collection_name,
            filter=f"chunk_id in {chunk_ids}",
            output_fields=["*"]
        )

    def create_collection(self) -> None:
        """Tạo cả hai collection (vector + metadata) theo interface chung."""
        self.create_vector_collection()
        self.create_metadata_collection()

    def get_list_collection_name(self) -> list[str]:
        names = self.client.list_collections()
        logger.info("Có %d collection: %s", len(names), names)
        return names