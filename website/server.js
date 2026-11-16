const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const bcrypt = require('bcrypt');
require('dotenv').config();

const app = express();

app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'secretkey',
  resave: false,
  saveUninitialized: false
}));

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
}).promise();

const handle = (fn) => (req, res, next) => fn(req, res, next).catch(next);

function requireLogin(req, res, next) {
  if (!req.session.userId) return res.redirect('/login');
  next();
}

function checkTitle(raw) {
  const title = (raw || '').trim();
  if (title === '') return { title, error: 'Title is required' };
  if (title.length > 200) return { title, error: 'Title is too long (200 characters at most)' };
  return { title, error: null };
}

async function showTodos(req, res, opts = {}) {
  const [todos] = await db.execute(
    'SELECT todo_id, title, is_done, created_at FROM todos WHERE user_id = ? ORDER BY todo_id DESC',
    [req.session.userId]
  );
  res.status(opts.status || 200).render('todo', {
    name: req.session.userName,
    todos,
    errors: opts.errors || {},
    old: opts.old || {},
    editId: opts.editId || null
  });
}

app.get('/', (req, res) => {
  res.redirect(req.session.userId ? '/todo' : '/login');
});

app.get('/register', (req, res) => {
  if (req.session.userId) return res.redirect('/todo');
  res.render('register', { errors: {}, old: {} });
});

app.post('/register', handle(async (req, res) => {
  const name = (req.body.name || '').trim();
  const email = (req.body.email || '').trim();
  const password = req.body.password || '';
  const confirm = req.body.confirm_password || '';

  const errors = {};
  if (name === '') errors.name = 'Name is required';
  if (email === '') errors.email = 'Email is required';
  if (password === '') errors.password = 'Password is required';
  if (confirm === '') errors.confirm = 'Confirm password is required';
  else if (password !== '' && password !== confirm) errors.confirm = 'Passwords do not match';

  if (Object.keys(errors).length > 0) {
    return res.status(400).render('register', { errors, old: { name, email } });
  }

  try {
    const hash = await bcrypt.hash(password, 12);
    const [result] = await db.execute(
      'INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)',
      [email, name, hash]
    );
    req.session.userId = result.insertId;
    req.session.userName = name;
    res.redirect('/todo');
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).render('register', {
        errors: { email: 'Email Already Exists' },
        old: { name, email }
      });
    }
    throw err;
  }
}));

app.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect('/todo');
  res.render('login', { errors: {}, old: {} });
});

app.post('/login', handle(async (req, res) => {
  const email = (req.body.email || '').trim();
  const password = req.body.password || '';

  const errors = {};
  if (email === '') errors.email = 'Email is required';
  if (password === '') errors.password = 'Password is required';
  if (Object.keys(errors).length > 0) {
    return res.status(400).render('login', { errors, old: { email } });
  }

  const [rows] = await db.execute(
    'SELECT user_id, name, password_hash FROM users WHERE email = ?',
    [email]
  );
  const user = rows[0];
  const ok = user ? await bcrypt.compare(password, user.password_hash) : false;

  if (!ok) {
    return res.status(401).render('login', {
      errors: { general: 'Invalid email or password' },
      old: { email }
    });
  }

  req.session.userId = user.user_id;
  req.session.userName = user.name;
  res.redirect('/todo');
}));

app.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

app.get('/todo', requireLogin, handle(async (req, res) => {
  await showTodos(req, res);
}));

app.post('/todo', requireLogin, handle(async (req, res) => {
  const { title, error } = checkTitle(req.body.title);
  if (error) {
    return showTodos(req, res, { status: 400, errors: { add: error }, old: { title: req.body.title || '' } });
  }
  await db.execute(
    'INSERT INTO todos (user_id, title) VALUES (?, ?)',
    [req.session.userId, title]
  );
  res.redirect('/todo');
}));

app.post('/todo/edit/:id', requireLogin, handle(async (req, res) => {
  const { title, error } = checkTitle(req.body.title);
  if (error) {
    return showTodos(req, res, {
      status: 400,
      errors: { edit: error },
      old: { title: req.body.title || '' },
      editId: req.params.id
    });
  }
  await db.execute(
    'UPDATE todos SET title = ? WHERE todo_id = ? AND user_id = ?',
    [title, req.params.id, req.session.userId]
  );
  res.redirect('/todo');
}));

app.post('/todo/done/:id', requireLogin, handle(async (req, res) => {
  const isDone = req.body.is_done === '1' ? 1 : 0;
  await db.execute(
    'UPDATE todos SET is_done = ? WHERE todo_id = ? AND user_id = ?',
    [isDone, req.params.id, req.session.userId]
  );
  res.redirect('/todo');
}));

app.post('/todo/delete/:id', requireLogin, handle(async (req, res) => {
  await db.execute(
    'DELETE FROM todos WHERE todo_id = ? AND user_id = ?',
    [req.params.id, req.session.userId]
  );
  res.redirect('/todo');
}));

// image upload (bonus) - files are saved in public/uploads
const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: 'public/uploads',
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    cb(null, file.mimetype.startsWith('image/'));
  }
});

// library database connection
const libDb = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.LIB_DB_NAME,
  dateStrings: true,
  waitForConnections: true,
  connectionLimit: 10
}).promise();

// SQL for each page (? is where a value goes)
const SQL = {
  allAuthors: 'SELECT author_id, name, country, photo FROM author ORDER BY author_id',
  oneAuthor: 'SELECT author_id, name, country, photo FROM author WHERE author_id = ?',
  addAuthor: 'INSERT INTO author (name, country) VALUES (?, ?)',
  editAuthor: 'UPDATE author SET name = ?, country = ? WHERE author_id = ?',
  deleteAuthor: 'DELETE FROM author WHERE author_id = ?',
  allBooks: 'SELECT book_id, title, price, publish_year, author_id, publisher_id, category_id, cover FROM book ORDER BY book_id',
  oneBook: 'SELECT book_id, title, price, publish_year, author_id, publisher_id, category_id, cover FROM book WHERE book_id = ?',
  addBook: 'INSERT INTO book (title, price, publish_year, author_id, publisher_id, category_id) VALUES (?, ?, ?, ?, ?, ?)',
  editBook: 'UPDATE book SET title = ?, price = ?, publish_year = ?, author_id = ?, publisher_id = ?, category_id = ? WHERE book_id = ?',
  allPublishers: 'SELECT publisher_id, name FROM publisher ORDER BY name',
  allCategories: 'SELECT category_id, name FROM category ORDER BY name',
  deleteBook: 'DELETE FROM book WHERE book_id = ?',
  setPhoto: 'UPDATE author SET photo = ? WHERE author_id = ?',
  setCover: 'UPDATE book SET cover = ? WHERE book_id = ?'
};

// same sizes as the VARCHARs in the DDL
const MAX = { name: 100, country: 50, title: 200 };

function checkText(raw, label, max) {
  const value = (raw || '').trim();
  if (value === '') return { value, error: label + ' is required' };
  if (value.length > max) return { value, error: label + ' is too long (' + max + ' characters at most)' };
  return { value, error: null };
}

function checkPrice(raw) {
  const text = (raw || '').trim();
  if (text === '') return { value: null, error: 'Price is required' };
  const n = Number(text);
  if (isNaN(n) || n < 0) return { value: null, error: 'Price must be a number of 0 or more' };
  if (n > 99999999) return { value: null, error: 'Price is too large' };
  return { value: n.toFixed(2), error: null };
}

function checkAuthorId(raw) {
  if (!raw || isNaN(raw)) return { value: null, error: 'Please choose an author' };
  return { value: Number(raw), error: null };
}

function checkId(raw, label) {
  if (!raw || isNaN(raw)) return { value: null, error: 'Please choose a ' + label };
  return { value: Number(raw), error: null };
}

function checkYear(raw) {
  const text = (raw || '').trim();
  if (text === '') return { value: null, error: 'Year is required' };
  const n = Number(text);
  if (!Number.isInteger(n) || n < 0 || n > 2100) return { value: null, error: 'Year must be a whole number like 1999' };
  return { value: n, error: null };
}

// checks every field of the book form, returns the values and the first error
function checkBook(body) {
  const title = checkText(body.title, 'Title', MAX.title);
  const price = checkPrice(body.price);
  const year = checkYear(body.publish_year);
  const author = checkAuthorId(body.author_id);
  const publisher = checkId(body.publisher_id, 'publisher');
  const category = checkId(body.category_id, 'category');
  return {
    values: [title.value, price.value, year.value, author.value, publisher.value, category.value],
    error: title.error || price.error || year.error || author.error || publisher.error || category.error
  };
}

async function bookLists() {
  const [authors] = await libDb.execute(SQL.allAuthors);
  const [publishers] = await libDb.execute(SQL.allPublishers);
  const [categories] = await libDb.execute(SQL.allCategories);
  return { authors, publishers, categories };
}

// authors
async function showAuthors(req, res, opts = {}) {
  const [authors] = await libDb.execute(SQL.allAuthors);
  res.status(opts.status || 200).render('authors', {
    userName: req.session.userName,
    authors,
    errors: opts.errors || {},
    old: opts.old || {}
  });
}

app.get('/authors', requireLogin, handle(async (req, res) => {
  await showAuthors(req, res);
}));

app.post('/authors', requireLogin, upload.single('photo'), handle(async (req, res) => {
  const name = checkText(req.body.name, 'Name', MAX.name);
  const country = checkText(req.body.country, 'Country', MAX.country);
  const error = name.error || country.error;
  if (error) {
    return showAuthors(req, res, { status: 400, errors: { add: error }, old: req.body });
  }
  const [result] = await libDb.execute(SQL.addAuthor, [name.value, country.value]);
  if (req.file) {
    await libDb.execute(SQL.setPhoto, [req.file.filename, result.insertId]);
  }
  res.redirect('/authors');
}));

app.get('/authors/:id/edit', requireLogin, handle(async (req, res) => {
  const [rows] = await libDb.execute(SQL.oneAuthor, [req.params.id]);
  if (rows.length === 0) {
    return res.status(404).render('error', { title: 'Page not found', message: "This page doesn't exist." });
  }
  res.render('author-edit', { userName: req.session.userName, author: rows[0], error: '' });
}));

app.post('/authors/:id/edit', requireLogin, upload.single('photo'), handle(async (req, res) => {
  const name = checkText(req.body.name, 'Name', MAX.name);
  const country = checkText(req.body.country, 'Country', MAX.country);
  const error = name.error || country.error;
  if (error) {
    const typed = { author_id: req.params.id, name: req.body.name || '', country: req.body.country || '', photo: req.body.old_photo || '' };
    return res.status(400).render('author-edit', { userName: req.session.userName, author: typed, error });
  }
  await libDb.execute(SQL.editAuthor, [name.value, country.value, req.params.id]);
  if (req.file) {
    await libDb.execute(SQL.setPhoto, [req.file.filename, req.params.id]);
  }
  res.redirect('/authors');
}));

app.post('/authors/:id/delete', requireLogin, handle(async (req, res) => {
  await libDb.execute(SQL.deleteAuthor, [req.params.id]);
  res.redirect('/authors');
}));

// books
async function showBooks(req, res, opts = {}) {
  const [books] = await libDb.execute(SQL.allBooks);
  const lists = await bookLists();
  res.status(opts.status || 200).render('books', {
    userName: req.session.userName,
    books,
    ...lists,
    errors: opts.errors || {},
    old: opts.old || {}
  });
}

app.get('/books', requireLogin, handle(async (req, res) => {
  await showBooks(req, res);
}));

app.post('/books', requireLogin, upload.single('cover'), handle(async (req, res) => {
  const { values, error } = checkBook(req.body);
  if (error) {
    return showBooks(req, res, { status: 400, errors: { add: error }, old: req.body });
  }
  try {
    const [result] = await libDb.execute(SQL.addBook, values);
    if (req.file) {
      await libDb.execute(SQL.setCover, [req.file.filename, result.insertId]);
    }
  } catch (err) {
    // author, publisher or category does not exist
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return showBooks(req, res, { status: 400, errors: { add: 'Please choose an existing author, publisher and category' }, old: req.body });
    }
    throw err;
  }
  res.redirect('/books');
}));

app.get('/books/:id/edit', requireLogin, handle(async (req, res) => {
  const [rows] = await libDb.execute(SQL.oneBook, [req.params.id]);
  if (rows.length === 0) {
    return res.status(404).render('error', { title: 'Page not found', message: "This page doesn't exist." });
  }
  const lists = await bookLists();
  res.render('book-edit', { userName: req.session.userName, book: rows[0], ...lists, error: '' });
}));

app.post('/books/:id/edit', requireLogin, upload.single('cover'), handle(async (req, res) => {
  const { values, error } = checkBook(req.body);
  const lists = await bookLists();
  const typed = {
    book_id: req.params.id, title: req.body.title || '', price: req.body.price || '',
    publish_year: req.body.publish_year || '', author_id: req.body.author_id || '',
    publisher_id: req.body.publisher_id || '', category_id: req.body.category_id || '',
    cover: req.body.old_cover || ''
  };
  if (error) {
    return res.status(400).render('book-edit', { userName: req.session.userName, book: typed, ...lists, error });
  }
  try {
    await libDb.execute(SQL.editBook, [...values, req.params.id]);
    if (req.file) {
      await libDb.execute(SQL.setCover, [req.file.filename, req.params.id]);
    }
  } catch (err) {
    if (err.code === 'ER_NO_REFERENCED_ROW_2') {
      return res.status(400).render('book-edit', { userName: req.session.userName, book: typed, ...lists, error: 'Please choose an existing author, publisher and category' });
    }
    throw err;
  }
  res.redirect('/books');
}));

app.post('/books/:id/delete', requireLogin, handle(async (req, res) => {
  await libDb.execute(SQL.deleteBook, [req.params.id]);
  res.redirect('/books');
}));

// ===== Lab 4: search pages =====
// the same SQL is in problem2_Queries.sql
const SEARCH = {
  categories: 'SELECT category_id, name FROM category ORDER BY name',
  searchAll: 'SELECT title, price, publish_year FROM book WHERE title LIKE ? AND price BETWEEN ? AND ? ORDER BY price', // F2.1  title, price, publish_year      ? = keyword, min price, max price
  searchCategory: 'SELECT title, price, publish_year FROM book WHERE title LIKE ? AND price BETWEEN ? AND ? AND category_id = ? ORDER BY price', // F2.1  title, price, publish_year      ? = keyword, min price, max price, category_id
  catalogue: 'SELECT b.title, b.price, b.publish_year, a.name AS author, p.name AS publisher, c.name AS category FROM book b JOIN author a ON b.author_id = a.author_id JOIN publisher p ON b.publisher_id = p.publisher_id JOIN category c ON b.category_id = c.category_id ORDER BY b.title', // F2.2  title, price, publish_year, author, publisher, category
  perCategory: 'SELECT c.name AS category, COUNT(*) AS books, AVG(b.price) AS avg_price FROM book b JOIN category c ON b.category_id = c.category_id GROUP BY c.name', // F2.3a category, books, avg_price
  bigAuthors: 'SELECT a.name AS author, COUNT(*) AS books FROM book b JOIN author a ON b.author_id = a.author_id GROUP BY a.name HAVING COUNT(*) >= 2', // F2.3b author, books
  priceStats: 'SELECT SUM(price) AS total, MIN(price) AS cheapest, MAX(price) AS most_expensive FROM book', // F2.3c total, cheapest, most_expensive
  notReturned: 'SELECT b.title, m.name AS member, l.loan_date FROM loan l JOIN book b ON l.book_id = b.book_id JOIN member m ON l.member_id = m.member_id WHERE l.return_date IS NULL', // F2.4a title, member, loan_date
  noLoanMembers: 'SELECT m.name, m.email FROM member m LEFT JOIN loan l ON l.member_id = m.member_id WHERE l.loan_id IS NULL', // F2.4b name, email
  neverBorrowed: 'SELECT b.title FROM book b LEFT JOIN loan l ON l.book_id = b.book_id WHERE l.loan_id IS NULL', // F2.4c title
  topBooks: 'SELECT b.title, COUNT(*) AS loans FROM loan l JOIN book b ON l.book_id = b.book_id GROUP BY b.book_id, b.title ORDER BY loans DESC LIMIT 3', // F2.5  title, loans
  topMember: 'SELECT m.name, COUNT(*) AS loans FROM loan l JOIN member m ON l.member_id = m.member_id GROUP BY m.member_id, m.name ORDER BY loans DESC LIMIT 1', // F2.5  name, loans
  authorCounts: 'SELECT a.name AS author, COUNT(b.book_id) AS books FROM author a LEFT JOIN book b ON b.author_id = a.author_id GROUP BY a.author_id, a.name', // F2.6a author, books
  sameCountry: 'SELECT b.title, a.name AS author, p.name AS publisher, a.country FROM book b JOIN author a ON b.author_id = a.author_id JOIN publisher p ON b.publisher_id = p.publisher_id WHERE a.country = p.country' // F2.6b title, author, publisher, country
};

// F2.1 the form uses GET, so the values come in req.query
app.get('/search', requireLogin, handle(async (req, res) => {
  const [categories] = await libDb.execute(SEARCH.categories);
  let books = null;
  if (req.query.keyword !== undefined) {
    const like = '%' + req.query.keyword.trim() + '%';
    const min = req.query.min ? Number(req.query.min) : 0;
    const max = req.query.max ? Number(req.query.max) : 99999999;
    if (isNaN(min) || isNaN(max)) {
      return res.status(400).render('search', { userName: req.session.userName, categories, books: null, q: req.query, error: 'Prices must be numbers' });
    }
    if (req.query.category) {
      [books] = await libDb.execute(SEARCH.searchCategory, [like, min, max, req.query.category]);
    } else {
      [books] = await libDb.execute(SEARCH.searchAll, [like, min, max]);
    }
  }
  res.render('search', { userName: req.session.userName, categories, books, q: req.query, error: '' });
}));

// F2.2
app.get('/catalogue', requireLogin, handle(async (req, res) => {
  const [books] = await libDb.execute(SEARCH.catalogue);
  res.render('catalogue', { userName: req.session.userName, books });
}));

// F2.3
app.get('/reports', requireLogin, handle(async (req, res) => {
  const [perCategory] = await libDb.execute(SEARCH.perCategory);
  const [bigAuthors] = await libDb.execute(SEARCH.bigAuthors);
  const [stats] = await libDb.execute(SEARCH.priceStats);
  res.render('reports', { userName: req.session.userName, perCategory, bigAuthors, stats: stats[0] });
}));

// F2.4
app.get('/loans', requireLogin, handle(async (req, res) => {
  const [notReturned] = await libDb.execute(SEARCH.notReturned);
  const [noLoanMembers] = await libDb.execute(SEARCH.noLoanMembers);
  const [neverBorrowed] = await libDb.execute(SEARCH.neverBorrowed);
  res.render('loans', { userName: req.session.userName, notReturned, noLoanMembers, neverBorrowed });
}));

// F2.5
app.get('/popular', requireLogin, handle(async (req, res) => {
  const [topBooks] = await libDb.execute(SEARCH.topBooks);
  const [topMember] = await libDb.execute(SEARCH.topMember);
  res.render('popular', { userName: req.session.userName, topBooks, topMember: topMember[0] });
}));

// F2.6
app.get('/author-report', requireLogin, handle(async (req, res) => {
  const [authorCounts] = await libDb.execute(SEARCH.authorCounts);
  const [sameCountry] = await libDb.execute(SEARCH.sameCountry);
  res.render('author-report', { userName: req.session.userName, authorCounts, sameCountry });
}));

// must stay last
app.use((req, res) => {
  res.status(404).render('error', { title: 'Page not found', message: "This page doesn't exist." });
});

app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).render('error', { title: 'Image too big', message: 'The image must be 10 MB at most.' });
  }
  console.error(err);
  res.status(500).render('error', { title: 'Something went wrong', message: 'Please try again later.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
