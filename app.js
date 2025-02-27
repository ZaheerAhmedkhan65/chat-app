const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const authRoutes = require('./routes/authRoutes');
const messageRoutes = require('./routes/messageRoutes');
const friendRoutes = require('./routes/friendRoutes');
const userRoutes = require('./routes/userRoutes');
const multer = require('multer');
const path = require('path');
const cookieParser = require('cookie-parser');



const app = express();

// Set up EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true })); // For form data
app.use(cookieParser());

// Serve static files (CSS, JS, images)
app.use(express.static(path.join(__dirname, 'public')));
app.use('/img', express.static(path.join(__dirname, 'public/img')));

// Routes

app.use('/auth', authRoutes);
app.use('/messages', messageRoutes);
app.use('/friends', friendRoutes);
app.use('/users', userRoutes);

// Home route
app.get('/',  (req, res) => {
  res.render('index'); // Render the index.ejs file
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, 'public/uploads')); // Save files in the 'uploads' directory
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + '-' + file.originalname); // Generate unique filenames
  },
});

const upload = multer({ storage });

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Add the upload middleware to your routes
app.post('/upload', upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }
  const imageUrl = `/uploads/${req.file.filename}`; // Generate the file URL
  res.json({ imageUrl });
});

app.get('*', (req, res) => {
  res.status(404).render('notfound');
});

module.exports = app;