import { Library } from './models/book';
import { BookService } from './services/bookService';

const bookService = new BookService();
bookService.addBook(new Library.Book('The Hobbit', 'J.R.R. Tolkien'));
const books = bookService.getAllBooks();
console.log(books);
