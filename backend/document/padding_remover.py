import os
import time
from PIL import Image, ImageDraw, ImageFont
from paddleocr import TextDetection
import cv2
import numpy as np

from ..core.logging import get_logger

logger = get_logger(__name__)

# cắt ảnh và loại bỏ padding theo ngưỡng
def cut_padding(img, top=0, bottom=0, left=0, right=0):
    width, height = img.size
    left = min(max(left, 0), width)
    right = min(max(right, 0), width - left)
    top = min(max(top, 0), height)
    bottom = min(max(bottom, 0), height - top)
    return img.crop((left, top, width - right, height - bottom))

# vẽ hộp chữ và hộp lớn bao quanh
def draw_boxes_and_bigbox(img, boxes, box_big, output_path, font_path=None):
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype(font_path if font_path else "arial.ttf", 18)
    except:
        font = ImageFont.load_default()
    for box in boxes:
        coords = [int(c) for c in box['coordinate']]
        draw.rectangle(coords, outline='blue', width=3)
    draw.rectangle(box_big, outline='red', width=5)
    draw.text((box_big[0]+10, box_big[1]+10), "Big Box", fill='red', font=font)
    img.save(output_path)
    logger.debug(f"[DEBUG] Saved debug overlay: {output_path}")

# thêm padding để ảnh có kích thước đồng nhất
def pad_to_max_width(cropped_img, max_W, max_H=None, fill_color=(255,255,255)):
    w, h = cropped_img.size
    if max_H is None:
        max_H = h
    new_img = Image.new("RGB", (max_W, max_H), fill_color)
    paste_x = (max_W - w)//2
    paste_y = (max_H - h)//2
    new_img.paste(cropped_img, (paste_x, paste_y))
    return new_img

# phát hiện văn bản và thu thập thông tin
def detect_text_and_collect_info(batch_imgs_pil, batch_imgs_cv, model, padding=10):
    crop_infos = []
    max_W = 0

    results = model.predict(batch_imgs_cv)

    for j, result in enumerate(results):
        img_cut = batch_imgs_pil[j]
        # file = batch_filenames[j]

        polygons = result['dt_polys']
        if polygons is None or len(polygons) == 0:
            logger.debug(f"[WARN] No text detected in image {j}. Skipping.")
            continue

        boxes = []
        for poly in polygons:
            xs = [point[0] for point in poly]
            ys = [point[1] for point in poly]
            boxes.append({
                'coordinate': [int(min(xs)), int(min(ys)), int(max(xs)), int(max(ys))]
            })

        x_min = max(0, min([b['coordinate'][0] for b in boxes]) - padding)
        y_min = max(0, min([b['coordinate'][1] for b in boxes]) - padding)
        x_max = min(img_cut.width, max([b['coordinate'][2] for b in boxes]) + padding)
        y_max = min(img_cut.height, max([b['coordinate'][3] for b in boxes]) + padding)

        crop_box = (int(x_min), int(y_min), int(x_max), int(y_max))
        width = x_max - x_min
        max_W = max(max_W, width)

        crop_infos.append({
            # "filename": file,
            "img_cut": img_cut,
            "boxes": boxes,
            "crop_box": crop_box
        })

    return crop_infos, max_W

# xử lý thư mục, phát hiện văn bản và thêm padding
def process_folder_cut_detect_pad(
    images,
    output_folder,
    model,
    cut_params=(0, 0, 0, 0),
    padding=10,
    batch_size=8,
    draw_debug=False
):
    os.makedirs(output_folder, exist_ok=True)
    clean_image_folder = os.path.join(output_folder, "clean_images")
    os.makedirs(clean_image_folder, exist_ok=True)
    debug_folder = os.path.join(output_folder, "debug")
    os.makedirs(debug_folder, exist_ok=True)

    imgs_cv_list, imgs_pil_list = [], []

    # Load all images and cut padding
    for img in images:
        img_cut = cut_padding(img, *cut_params)
        img_cv = cv2.cvtColor(np.array(img_cut), cv2.COLOR_RGB2BGR)
        imgs_cv_list.append(img_cv)
        imgs_pil_list.append(img_cut)

    # Predict on all images at once with batch_size
    results = model.predict(imgs_cv_list, batch_size=batch_size)

    crop_infos_all = []
    global_max_W = 0

    for j, result in enumerate(results):
        img_cut = imgs_pil_list[j]
        polygons = result['dt_polys']
        if polygons is None or len(polygons) == 0:
            logger.debug(f"[WARN] No text detected in image {j}. Skipping.")
            continue

        boxes = []
        for poly in polygons:
            xs = [point[0] for point in poly]
            ys = [point[1] for point in poly]
            boxes.append({
                'coordinate': [int(min(xs)), int(min(ys)), int(max(xs)), int(max(ys))]
            })

        x_min = max(0, min([b['coordinate'][0] for b in boxes]) - padding)
        y_min = max(0, min([b['coordinate'][1] for b in boxes]) - padding)
        x_max = min(img_cut.width, max([b['coordinate'][2] for b in boxes]) + padding)
        y_max = min(img_cut.height, max([b['coordinate'][3] for b in boxes]) + padding)

        crop_box = (int(x_min), int(y_min), int(x_max), int(y_max))
        width = x_max - x_min
        global_max_W = max(global_max_W, width)

        crop_infos_all.append({
            "img_cut": img_cut,
            "boxes": boxes,
            "crop_box": crop_box
        })

    if not crop_infos_all:
        logger.debug("[ERROR] No valid images detected.")
        return

    padded_images = []

    for i, info in enumerate(crop_infos_all):
        cropped = info["img_cut"].crop(info["crop_box"])
        padded = pad_to_max_width(cropped, global_max_W)
        padded_images.append(padded)

        if draw_debug:
            padded.save(os.path.join(clean_image_folder, f"page_{i}.png"))
            debug_img = info["img_cut"].copy()
            draw_boxes_and_bigbox(debug_img, info["boxes"], info["crop_box"],
                                  os.path.join(debug_folder, f"debug_{i}.png"))

    logger.debug(f"[DONE] Processed {len(crop_infos_all)} images with padding & text detection.")
    return padded_images

# Example usage
if __name__ == "__main__":
    os.environ["CUDA_VISIBLE_DEVICES"] = "0"

    input_folder = "output_quyen3"
    output_folder = "input_quyen3_cut_detect_pad"
    CUT_TOP, CUT_BOTTOM, CUT_LEFT, CUT_RIGHT = 20, 10, 80, 100
    PADDING = 35
    DRAW_DEBUG = True
    BATCH_SIZE = 16

    model = TextDetection(model_name="PP-OCRv5_server_det")

    process_folder_cut_detect_pad(
        input_folder=input_folder,
        output_folder=output_folder,
        model=model,
        cut_params=(CUT_TOP, CUT_BOTTOM, CUT_LEFT, CUT_RIGHT),
        padding=PADDING,
        batch_size=BATCH_SIZE,
        draw_debug=DRAW_DEBUG
    )