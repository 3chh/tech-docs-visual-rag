import cv2
import numpy as np
from scipy.ndimage import interpolation as inter

from ..core.logging import get_logger

logger = get_logger(__name__)

def correct_skew(image, delta=1, limit=5):

    ''' Xoay ảnh arr (nhị phân) ở một góc angle.
        Tính histogram hàng: tổng số pixel trắng mỗi hàng → thể hiện cấu trúc dòng văn bản.
        Tính score: chênh lệch bình phương giữa các hàng liền kề.
        Nếu ảnh được xoay về đúng góc ngang,
        các dòng văn bản rõ ràng hơn → histogram thay đổi rõ ràng giữa các hàng → score cao hơn.'''
    def determine_score(arr, angle):
        data = inter.rotate(arr, angle, reshape=False, order=0)
        histogram = np.sum(data, axis=1, dtype=float)
        score = np.sum((histogram[1:] - histogram[:-1]) ** 2, dtype=float)
        return histogram, score

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU)[1] 

    ''' Dò các góc từ -5 đến +5 độ (bước 1 độ).
    Tính score cho mỗi góc.
    Chọn best_angle là góc cho score lớn nhất.'''
    scores = []
    angles = np.arange(-limit, limit + delta, delta)
    for angle in angles:
        histogram, score = determine_score(thresh, angle)
        scores.append(score)

    best_angle = angles[scores.index(max(scores))]

    '''Tính ma trận xoay.
    Xoay lại ảnh ban đầu về góc tốt nhất để hiệu chỉnh nghiêng.'''
    (h, w) = image.shape[:2]
    #
    center = (w // 2, h // 2)
    # Tính ma trận xoay với góc tốt nhất
    # getRotationMatrix2D trả về ma trận xoay 2D với góc xoay, tâm xoay và tỷ lệ.
    M = cv2.getRotationMatrix2D(center, best_angle, 1.0)
    corrected = cv2.warpAffine(image, M, (w, h), flags=cv2.INTER_CUBIC, \
            borderMode=cv2.BORDER_REPLICATE)

    return best_angle, corrected

if __name__ == '__main__':
    image = cv2.imread('output_h1/page_94.png')
    angle, corrected = correct_skew(image)
    logger.debug('Skew angle:', angle)
    # lưu ảnh đã hiệu chỉnh
    cv2.imwrite('output_corrected_h1/corrected_page_94.png', corrected)
    cv2.imshow('corrected', corrected)
    cv2.waitKey()