abstract class Animal {
    abstract sound(): void;
}
class Dog extends Animal {
    sound(): void {}
}
class Cat extends Animal {
    sound(): void {}
}
class Pig extends Animal {
    sound(): void {}
}
function makeSound(animal: Animal) {
    animal.sound();
}

function main() {
    let cat = new Cat();
    makeSound(new Dog());
}
