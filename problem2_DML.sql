USE library;

INSERT INTO author (name, country) VALUES
('Jane Austen', 'England'),
('Naguib Mahfouz', 'Egypt'),
('Haruki Murakami', 'Japan'),
('Tawfiq al-Hakim', 'Egypt');

INSERT INTO publisher (name, country) VALUES
('Penguin Books', 'England'),
('Dar El Shorouk', 'Egypt'),
('Vintage', 'USA');

INSERT INTO category (name) VALUES
('Classic'),
('Modern Fiction'),
('Short Stories');

INSERT INTO book (title, price, publish_year, author_id, publisher_id, category_id) VALUES
('Emma', 12.50, 1815, 1, 1, 1),
('Persuasion', 9.99, 1817, 1, 1, 1),
('Pride and Prejudice', 11.00, 1813, 1, 1, 1),
('Palace Walk', 15.00, 1956, 2, 2, 2),
('Midaq Alley', 8.75, 1947, 2, 2, 2),
('Kafka on the Shore', 14.20, 2002, 3, 3, 2),
('Sugar Street', 17.50, 1957, 2, 2, 2),
('Norwegian Wood', 13.40, 1987, 3, 3, 2),
('The Elephant Vanishes', 10.90, 1993, 3, 3, 3),
('Sense and Sensibility', 10.50, 1811, 1, 1, 1);

INSERT INTO member (name, email, join_date) VALUES
('Omar Hassan', 'omar@example.com', '2026-01-10'),
('Mona Adel', 'mona@example.com', '2026-02-03'),
('Youssef Samir', 'youssef@example.com', '2026-03-15'),
('Salma Nabil', 'salma@example.com', '2026-04-20'),
('Karim Fathy', 'karim@example.com', '2026-05-01');

-- return_date NULL = the book is still borrowed
INSERT INTO loan (book_id, member_id, loan_date, return_date) VALUES
(4, 1, '2026-06-01', '2026-06-10'),
(4, 2, '2026-06-12', '2026-06-20'),
(4, 3, '2026-07-01', '2026-07-09'),
(4, 1, '2026-08-02', '2026-08-11'),
(1, 1, '2026-06-05', '2026-06-15'),
(1, 4, '2026-07-10', '2026-07-18'),
(1, 2, '2026-09-01', '2026-09-08'),
(6, 3, '2026-07-20', '2026-07-30'),
(6, 1, '2026-10-01', '2026-10-12'),
(2, 4, '2026-08-15', '2026-08-25'),
(5, 2, '2026-09-10', '2026-09-19'),
(8, 1, '2026-11-01', NULL);
