import type { User } from '../types';

export const login = (email: string): void => {
  const user: User = { email, name: email.split('@')[0] };
  localStorage.setItem('exam_user', JSON.stringify(user));
};

export const logout = (): void => {
  localStorage.removeItem('exam_user');
};

export const getUser = (): User | null => {
  const userStr = localStorage.getItem('exam_user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr) as User;
  } catch {
    return null;
  }
};

export const isAuthenticated = (): boolean => {
  return getUser() !== null;
};
