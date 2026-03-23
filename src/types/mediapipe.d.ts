// Allow TS to compile https imports
declare module 'https://*' {
  const value: any;
  export default value;
  export const FaceDetector: any;
  export const FilesetResolver: any;
}
