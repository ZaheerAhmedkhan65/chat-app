const cors = require('cors');
const path = require('path');
const helmet = require('helmet');
const morgan = require("morgan");
const express = require('express');
const bodyParser = require('body-parser');
const appRoutes = require('../routes/app.routes');
const cookieParser = require('cookie-parser');
const methodOverride = require("method-override");
const expressLayouts = require("express-ejs-layouts");

const app = express();

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      imgSrc: ["'self'", "data:", "https:"],
      fontSrc: ["'self'", "https://cdnjs.cloudflare.com"],
      connectSrc: ["'self'"]
    }
  }
}));

app.use(express.static(path.join(__dirname, '../app/assets')));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '../app/views'));
app.set('layout', 'layouts/application');

app.use(cors());
app.use(bodyParser.json());
app.use(express.urlencoded({ extended: true, limit: '10mb' })); 
app.use(cookieParser());
app.use(morgan('dev'));
app.use(methodOverride("_method"));
app.use(expressLayouts);

// Serve static files (CSS, JS, images)
app.use(express.static(path.join(__dirname, 'public')));
app.use('/img', express.static(path.join(__dirname, 'public/img')));

appRoutes(app);

app.get('*', (req, res) => {
  res.status(404).render('notfound');
});

module.exports = app;