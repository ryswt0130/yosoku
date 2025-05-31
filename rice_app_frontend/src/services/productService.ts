import apiClient from './apiClient';
import { ProductData } from '../interfaces';

const BASE_URL = '/products'; // Relative to apiClient's baseURL (/api/v1)

const getMyProducts = async (): Promise<ProductData[]> => {
  const response = await apiClient.get<ProductData[]>(`${BASE_URL}/my_products/`);
  return response.data;
};

const getProductById = async (productId: number): Promise<ProductData> => {
  const response = await apiClient.get<ProductData>(`${BASE_URL}/${productId}/`);
  return response.data;
};

// Function for public browsing of products
const getPublicProducts = async (params?: { search?: string; producer_id?: string; rice_type?: string }): Promise<ProductData[]> => {
  const response = await apiClient.get<ProductData[]>(BASE_URL + '/', { params });
  return response.data;
};

const createProduct = async (productData: FormData): Promise<ProductData> => {
  const response = await apiClient.post<ProductData>(BASE_URL + '/', productData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

const updateProduct = async (productId: number, productData: FormData): Promise<ProductData> => {
  const response = await apiClient.patch<ProductData>(`${BASE_URL}/${productId}/`, productData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

const deleteProduct = async (productId: number): Promise<void> => {
  await apiClient.delete(`${BASE_URL}/${productId}/`);
};

const productService = {
  getMyProducts,
  getProductById,
  getPublicProducts, // Added this
  createProduct,
  updateProduct,
  deleteProduct,
};

export default productService;
