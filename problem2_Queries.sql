USE library;

-- F2.1 search books (all categories), example: title has "a", price 10 to 20
SELECT title, price, publish_year
FROM book
WHERE title LIKE '%a%' AND price BETWEEN 10 AND 20
ORDER BY price;

-- F2.1 search books (one category), example: category 2
SELECT title, price, publish_year
FROM book
WHERE title LIKE '%a%' AND price BETWEEN 10 AND 20 AND category_id = 2
ORDER BY price;

-- F2.2 catalogue
SELECT b.title, b.price, b.publish_year, a.name AS author, p.name AS publisher, c.name AS category
FROM book b
JOIN author a ON b.author_id = a.author_id
JOIN publisher p ON b.publisher_id = p.publisher_id
JOIN category c ON b.category_id = c.category_id
ORDER BY b.title;

-- F2.3 (a) number of books and average price of each category
SELECT c.name AS category, COUNT(*) AS books, AVG(b.price) AS avg_price
FROM book b JOIN category c ON b.category_id = c.category_id
GROUP BY c.name;

-- F2.3 (b) authors who wrote at least 2 books
SELECT a.name AS author, COUNT(*) AS books
FROM book b JOIN author a ON b.author_id = a.author_id
GROUP BY a.name
HAVING COUNT(*) >= 2;

-- F2.3 (c) total, smallest and largest price
SELECT SUM(price) AS total, MIN(price) AS cheapest, MAX(price) AS most_expensive
FROM book;

-- F2.4 (a) loans not returned yet
SELECT b.title, m.name AS member, l.loan_date
FROM loan l
JOIN book b ON l.book_id = b.book_id
JOIN member m ON l.member_id = m.member_id
WHERE l.return_date IS NULL;

-- F2.4 (b) members who never borrowed a book
SELECT m.name, m.email
FROM member m LEFT JOIN loan l ON l.member_id = m.member_id
WHERE l.loan_id IS NULL;

-- F2.4 (c) books that were never borrowed
SELECT b.title
FROM book b LEFT JOIN loan l ON l.book_id = b.book_id
WHERE l.loan_id IS NULL;

-- F2.5 the 3 books with the most loans
SELECT b.title, COUNT(*) AS loans
FROM loan l JOIN book b ON l.book_id = b.book_id
GROUP BY b.book_id, b.title
ORDER BY loans DESC
LIMIT 3;

-- F2.5 the member with the most loans
SELECT m.name, COUNT(*) AS loans
FROM loan l JOIN member m ON l.member_id = m.member_id
GROUP BY m.member_id, m.name
ORDER BY loans DESC
LIMIT 1;

-- F2.6 (a) every author with the number of books (0 included)
SELECT a.name AS author, COUNT(b.book_id) AS books
FROM author a LEFT JOIN book b ON b.author_id = a.author_id
GROUP BY a.author_id, a.name;

-- F2.6 (b) books whose author and publisher are from the same country
SELECT b.title, a.name AS author, p.name AS publisher, a.country
FROM book b
JOIN author a ON b.author_id = a.author_id
JOIN publisher p ON b.publisher_id = p.publisher_id
WHERE a.country = p.country;
