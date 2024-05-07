function factorial(n: number): number {
  if (n <= 1) {
      return 1;
  } else {
      return n * factorial(n - 1);
  }
}

function fizzBuzz(limit: number): void {
  for (let i = 1; i <= limit; i++) {
      if (i % 15 === 0) {
          console.log("FizzBuzz");
      } else if (i % 3 === 0) {
          console.log("Fizz");
      } else if (i % 5 === 0) {
          console.log("Buzz");
      } else {
          console.log(i);
      }
  }
  return;
}

function main(): void {
  console.log("Factorial of 5:", factorial(5));
  fizzBuzz(15);
}

main();
