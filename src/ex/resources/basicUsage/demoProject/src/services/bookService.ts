import { Library } from '../models/book';

export class BookService {
    private books: Library.Book[] = [];

    public addBook(book: Library.Book): void {
        this.books.push(book);
    }

    public getAllBooks(): Library.Book[] {
        return this.books;
    }

    public getBooksByAuthor(author: string): Library.Book[] {
        let ans: Library.Book[] = [];
        for (let i = 0; i < this.books.length; i++) {
            let book = this.books[i];
            if (book.author === author) {
                ans.push(book);
            }
        }
        return ans;
    }
}
