abstract class Animal {sound(): void {}}
class Dog extends Animal{ sound(): void {}}
class Cat extends Animal{ sound(): void {}}

function main() {
    makeSound(new Dog())
}

function makeSound(animal: Animal) {
    animal.sound()
}