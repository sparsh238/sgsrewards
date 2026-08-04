import multer, { FileFilterCallback } from 'multer';
import path from 'path';
import { RequestHandler } from 'express';

// Set storage engine
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, './uploads/images/');
    },
    filename: (req, file, cb) => {
        cb(null, file.fieldname + '-' + Date.now() + path.extname(file.originalname));
    }
});

// Check file type
function checkFileType(file: Express.Multer.File, cb: FileFilterCallback) {
    const filetypes = /jpeg|jpg|png|gif/;
    const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = filetypes.test(file.mimetype);

    if (mimetype && extname) {
        return cb(null, true);
    } else {
        cb(new Error('Error: Images Only!'));
    }
}

// Initialize upload
const upload: RequestHandler = multer({
    storage: storage,
    limits: { fileSize: 3000000 }, // Limit of 3MB per image
    fileFilter: function (req, file, cb: FileFilterCallback) {
        checkFileType(file, cb);
    }
}).single('image');

export default upload;
