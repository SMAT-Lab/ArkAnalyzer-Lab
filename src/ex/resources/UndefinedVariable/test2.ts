import { property } from './test';
class static2 {
    static p: property;
}

export function im() {
    console.log(static2.p.pp);
}
