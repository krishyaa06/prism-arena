/**
 * Built-in coding challenge bank.
 * Each answer list contains every accepted (normalised) answer.
 */
module.exports = [
    { id: 'js-map-reduce', level: 'Easy', lang: 'JavaScript', question: 'What does this return?\n```js\n[1, 2, 3].map(x => x * 2).reduce((a, b) => a + b)\n```', answers: ['12'] },
    { id: 'js-typeof-null', level: 'Easy', lang: 'JavaScript', question: 'What is the output?\n```js\nconsole.log(typeof null)\n```', answers: ['object'] },
    { id: 'js-plus-string', level: 'Easy', lang: 'JavaScript', question: 'What is the output?\n```js\nconsole.log(1 + "2" + 3)\n```', answers: ['123'] },
    { id: 'py-slice', level: 'Easy', lang: 'Python', question: 'What is printed?\n```py\nprint("prism"[::-1])\n```', answers: ['msirp'] },
    { id: 'py-list-mul', level: 'Easy', lang: 'Python', question: 'What is printed?\n```py\nprint(len([0] * 3 + [1] * 2))\n```', answers: ['5'] },
    { id: 'bin-42', level: 'Easy', lang: 'Logic', question: 'What is **42** in binary?', answers: ['101010', '0b101010'] },
    { id: 'hex-ff', level: 'Easy', lang: 'Logic', question: 'What is `0xFF + 1` in decimal?', answers: ['256'] },
    { id: 'js-array-sort', level: 'Medium', lang: 'JavaScript', question: 'What is the output?\n```js\nconsole.log([10, 9, 1].sort().join(","))\n```', answers: ['1,10,9'] },
    { id: 'py-dict', level: 'Medium', lang: 'Python', question: 'What is printed?\n```py\nd = {}\nfor c in "banana":\n    d[c] = d.get(c, 0) + 1\nprint(d["a"])\n```', answers: ['3'] },
    { id: 'fizzbuzz-15', level: 'Medium', lang: 'Logic', question: 'In FizzBuzz from 1 to 100, how many numbers print exactly **"FizzBuzz"**?', answers: ['6'] },
    { id: 'big-o-binary', level: 'Medium', lang: 'DSA', question: 'What is the time complexity of binary search? (Big-O)', answers: ['o(log n)', 'log n', 'o(logn)', 'logn'] },
    { id: 'fib-10', level: 'Medium', lang: 'Logic', question: 'If `fib(0)=0` and `fib(1)=1`, what is `fib(10)`?', answers: ['55'] },
    { id: 'js-closure', level: 'Hard', lang: 'JavaScript', question: 'What is logged?\n```js\nfor (var i = 0; i < 3; i++) setTimeout(() => console.log(i));\n```\n(answer with the three numbers separated by spaces)', answers: ['3 3 3'] },
    { id: 'stack-queue', level: 'Hard', lang: 'DSA', question: 'Push 1, 2, 3 onto a **stack**, pop once, then push 4. What is the top element?', answers: ['4'] },
    { id: 'primes-50', level: 'Hard', lang: 'Logic', question: 'How many prime numbers are there below **50**?', answers: ['15'] }
];
