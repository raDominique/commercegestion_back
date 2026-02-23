export interface PaginationResult<T> {
  status: 'success' | 'error' | 'fail' | 'partial_success';
  message: string;
  data?: T[] | null;
  summary?: T | null;
  page?: number;
  limit?: number;
  total?: number;
  search?: string;
  sortBy?: string;
  order?: 'asc' | 'desc';
  filter?: any;
}
