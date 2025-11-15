import multer from "multer";

const storage = multer.memoryStorage(); // store files in memory
export const upload = multer({ storage });
