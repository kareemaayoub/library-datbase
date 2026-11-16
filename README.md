# Lab 4 - Library: search pages

Introduction to Database Systems, Lab 4 (Part II).

## Team

| Name | ID | Group |
|------|----|-------|
| Kareem Mohamed Said Khalil Ayoub | 2304003 | 2 |
| Abdelrahman Waleed | 2304221 | 2 |

We did Part II. The website continues our Lab 3 site (register, login, to-do, books and authors).

## Files

- `problem2_DDL.sql` - creates the `library` database with 6 tables: author, publisher, category, book, member and loan, with the primary and foreign keys. Deleting an author deletes their books, and deleting a book deletes its loans (ON DELETE CASCADE).
- `problem2_DML.sql` - seed data: 4 authors, 3 publishers, 3 categories, 10 books, 5 members and 12 loans.
- `problem2_Queries.sql` - the SQL of every new page (F2.1 to F2.6).
- `website/` - the website.

## How to run

1. Install Node.js and MySQL.
2. Clone the repository and install the packages:
```
git clone https://github.com/kareemaayoub/library-datbase.git
cd library-datbase/website
npm install
```
3. Create the databases. Run these from the main folder of the repository (not from `website`), in this order:
```
mysql -u root -p < website/database/schema.sql
mysql -u root -p < problem2_DDL.sql
mysql -u root -p < problem2_DML.sql
```
4. In the `website` folder, copy `.env.example` to `.env` and put your own MySQL password:
```
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASS=your_password
DB_NAME=registration
LIB_DB_NAME=library
SESSION_SECRET=any_long_random_text
```
5. Start the server from the `website` folder:
```
npm start
```
6. Open http://localhost:3000, register, log in, and use the links at the top.

## New pages

- **F2.1 Search** (`/search`) - search books by a word in the title, a price range and a category. The results are cheapest first.
- **F2.2 Catalogue** (`/catalogue`) - every book with the author, publisher and category names.
- **F2.3 Reports** (`/reports`) - books and average price per category, authors with at least 2 books, and the total, smallest and largest price.
- **F2.4 Loans** (`/loans`) - loans not returned yet, members who never borrowed, and books never borrowed.
- **F2.5 Most borrowed** (`/popular`) - the top 3 books and the member with the most loans.
- **F2.6 Author report** (`/author-report`) - every author with their number of books (0 included), and books whose author and publisher are from the same country.

The Books page now also asks for the year, publisher and category of a book.

All SQL in the website uses `?` placeholders (prepared statements), so what the user types in the search form is never added to the SQL text.
