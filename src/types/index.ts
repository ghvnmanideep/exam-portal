export interface User {
  email: string;
  name: string;
}
export interface Question {
  id: number;
  text: string;
  options: string[];
  correctAnswer: number;
}
