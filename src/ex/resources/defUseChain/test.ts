function defUseChain() {
    let a = 1,
        b = 2;
    a = a + b;
    if (a < 2) {
        a = b;
    } else {
        console.log(a);
    }
    console.log(b);
}
