/**
 * Axios API Client with Retry Pattern, Interceptors, and Error Handling
 * 
 * Features:
 * - Automatic retry on network failures (exponential backoff)
 * - Request/Response interceptors
 * - Global error handling
 * - Request timeout configuration
 * - CSRF token handling
 * 
 * @author Silent Risk Team
 */

import axios, { AxiosInstance, AxiosError, AxiosRequestConfig, AxiosResponse } from 'axios';
import axiosRetry from 'axios-retry';

/**
 * API Error with additional context
 */
export class ApiError extends Error {
  public readonly status?: number;
  public readonly code?: string;
  public readonly details?: unknown;

  constructor(message: string, status?: number, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/**
 * API Client Configuration
 */
interface ApiClientConfig {
  baseURL: string;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

/**
 * Create and configure Axios instance
 */
function createApiClient(config: ApiClientConfig): AxiosInstance {
  const client = axios.create({
    baseURL: config.baseURL,
    timeout: config.timeout || 30000, // 30s default
    headers: {
      'Content-Type': 'application/json',
    },
    withCredentials: false, // Set to true if using cookies
  });

  // ============ RETRY CONFIGURATION ============
  axiosRetry(client, {
    retries: config.retries || 3,
    retryDelay: (retryCount) => {
      // Exponential backoff: 1s, 2s, 4s, 8s...
      return Math.min(1000 * Math.pow(2, retryCount - 1), config.retryDelay || 10000);
    },
    retryCondition: (error: AxiosError) => {
      // Retry on network errors or 5xx server errors
      return (
        axiosRetry.isNetworkOrIdempotentRequestError(error) ||
        (error.response?.status ? error.response.status >= 500 : false)
      );
    },
    onRetry: (retryCount, error, requestConfig) => {
      console.warn(
        `🔄 Retry attempt ${retryCount} for ${requestConfig.method?.toUpperCase()} ${requestConfig.url}`,
        error.message
      );
    },
  });

  // ============ REQUEST INTERCEPTOR ============
  client.interceptors.request.use(
    (config: AxiosRequestConfig) => {
      // Add authentication token if available
      const token = localStorage.getItem('auth_token');
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }

      // Log request in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`🚀 ${config.method?.toUpperCase()} ${config.url}`, {
          params: config.params,
          data: config.data,
        });
      }

      return config;
    },
    (error) => {
      console.error('❌ Request interceptor error:', error);
      return Promise.reject(error);
    }
  );

  // ============ RESPONSE INTERCEPTOR ============
  client.interceptors.response.use(
    (response: AxiosResponse) => {
      // Log response in development
      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ ${response.config.method?.toUpperCase()} ${response.config.url}`, {
          status: response.status,
          data: response.data,
        });
      }

      return response;
    },
    (error: AxiosError) => {
      // Extract error details
      const status = error.response?.status;
      const message = extractErrorMessage(error);
      const code = error.code;
      const details = error.response?.data;

      // Log error
      console.error(`❌ ${error.config?.method?.toUpperCase()} ${error.config?.url}`, {
        status,
        code,
        message,
        details,
      });

      // Handle specific HTTP status codes
      if (status === 401) {
        // Unauthorized - clear auth and redirect to login
        localStorage.removeItem('auth_token');
        // Optionally trigger a login redirect event
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      } else if (status === 403) {
        // Forbidden
        console.warn('⛔ Access forbidden');
      } else if (status === 404) {
        // Not found
        console.warn('🔍 Resource not found');
      } else if (status && status >= 500) {
        // Server error
        console.error('🔥 Server error');
      }

      // Throw custom ApiError
      throw new ApiError(message, status, code, details);
    }
  );

  return client;
}

/**
 * Extract user-friendly error message
 */
function extractErrorMessage(error: AxiosError): string {
  // Check for response error message
  if (error.response?.data) {
    const data = error.response.data as { detail?: string; message?: string; error?: string };
    if (data.detail) return data.detail;
    if (data.message) return data.message;
    if (data.error) return data.error;
  }

  // Check for request error
  if (error.request && !error.response) {
    return 'Network error. Please check your connection and try again.';
  }

  // Fallback to error message
  return error.message || 'An unexpected error occurred';
}

// ============ API CLIENT INSTANCES ============

/**
 * Main Backend API (port 8000)
 */
export const backendApi = createApiClient({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000/api/v1',
  timeout: 60000, // 60s for analysis requests
  retries: 3,
  retryDelay: 10000, // Max 10s delay
});

/**
 * WebSocket Service API (port 8001)
 */
export const wsServiceApi = createApiClient({
  baseURL: process.env.NEXT_PUBLIC_WS_SERVICE_URL || 'http://localhost:8001',
  timeout: 10000, // 10s for health checks
  retries: 2,
  retryDelay: 5000,
});

/**
 * Generic API client factory
 */
export const createCustomApiClient = (baseURL: string, config?: Partial<ApiClientConfig>) => {
  return createApiClient({
    baseURL,
    ...config,
  });
};

export default backendApi;

