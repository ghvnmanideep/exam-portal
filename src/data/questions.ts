import type { Question } from '../types';

export const QUESTIONS: Question[] = [
  {
    id: 1,
    text: 'What is the primary role of a frontend developer?',
    options: ['Managing databases', 'Designing server architectures', 'Building user interfaces', 'Configuring network routers'],
    correctAnswer: 2
  },
  {
    id: 2,
    text: 'Which hook should be used to perform side effects in React?',
    options: ['useState', 'useEffect', 'useMemo', 'useCallback'],
    correctAnswer: 1
  },
  {
    id: 3,
    text: 'What does CSS stand for?',
    options: ['Computer Style Sheets', 'Creative Style Sheets', 'Cascading Style Sheets', 'Colorful Style Sheets'],
    correctAnswer: 2
  },
  {
    id: 4,
    text: 'Which method is used to serialize an object into a JSON string in JavaScript?',
    options: ['JSON.parse()', 'JSON.stringify()', 'JSON.toString()', 'JSON.serialize()'],
    correctAnswer: 1
  },
  {
    id: 5,
    text: 'What does HTML stand for?',
    options: ['Hyper Text Markup Language', 'High Tech Modern Language', 'Hyper Transfer Markup Language', 'Home Tool Markup Language'],
    correctAnswer: 0
  },
  {
    id: 6,
    text: 'Which of the following is NOT a JavaScript data type?',
    options: ['String', 'Boolean', 'Float', 'Symbol'],
    correctAnswer: 2
  },
  {
    id: 7,
    text: 'What is the correct way to declare a variable in modern JavaScript (ES6+)?',
    options: ['var x = 5', 'let x = 5', 'variable x = 5', 'dim x = 5'],
    correctAnswer: 1
  },
  {
    id: 8,
    text: 'Which CSS property is used to add space inside an element\'s border?',
    options: ['margin', 'spacing', 'padding', 'border-spacing'],
    correctAnswer: 2
  },
  {
    id: 9,
    text: 'What does the React useState hook return?',
    options: [
      'A single state variable',
      'An array with the state value and an updater function',
      'An object with get and set methods',
      'A promise that resolves to the state'
    ],
    correctAnswer: 1
  },
  {
    id: 10,
    text: 'Which HTML tag is used to link an external CSS stylesheet?',
    options: ['<style>', '<script>', '<link>', '<css>'],
    correctAnswer: 2
  },
  {
    id: 11,
    text: 'What is the purpose of the "key" prop in React lists?',
    options: [
      'To style list items',
      'To help React identify which items changed, were added, or were removed',
      'To sort the list automatically',
      'To prevent the list from re-rendering'
    ],
    correctAnswer: 1
  },
  {
    id: 12,
    text: 'Which CSS value makes an element take up the full available width and start on a new line?',
    options: ['inline', 'inline-block', 'flex', 'block'],
    correctAnswer: 3
  },
  {
    id: 13,
    text: 'What is a closure in JavaScript?',
    options: [
      'A way to close the browser window',
      'A function that has access to variables from its outer lexical scope',
      'A method to end a loop early',
      'An error handling mechanism'
    ],
    correctAnswer: 1
  },
  {
    id: 14,
    text: 'Which HTTP method is typically used to create a new resource on a server?',
    options: ['GET', 'DELETE', 'PUT', 'POST'],
    correctAnswer: 3
  },
];
