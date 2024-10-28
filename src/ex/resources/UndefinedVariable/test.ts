export class property{
    pp=1;
}
class t{
    static s:property;
    p:property;
    constructor(){
    }
    static sm(){
        console.log(this.s.pp);
        console.log(t.s.pp);
    }
    method(){
        console.log(t.s);
    }
    print(){
        console.log(this.p.pp);
    }
}

function U2(){
    let t1 = new t();
    t1.print();
}

function U3(){
    let t1 = new t();
    print(t1);
}

function print(tp:t){
    console.log(tp.p.pp);
}
