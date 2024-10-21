import { Library } from '../models/book';

export class BookService {
    private books: Library.Book[] = [];

    public addBook(book: Library.Book): void {
        this.books.push(book);
    }

    public getAllBooks(): Library.Book[] {
        return this.books;
    }
}
