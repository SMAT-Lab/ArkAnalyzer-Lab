import { Logger } from './log';

abstract class Animal {
    abstract sound(): void;
}
class Dog extends Animal {
    sound(): void {
        Logger.warn('dog sound');
    }
}
class Cat extends Animal {
    sound(): void {
        Logger.error('dog sound');
    }
}

function main() {
    makeSound(new Dog());
    Logger.info('create new dog');
}

function makeSound(animal: Animal) {
    animal.sound();
}
