(() => {
  const display = document.querySelector('#display');
  const keypad = document.querySelector('.keypad');
  let expression = '';
  let resultShown = false;
  let hasError = false;

  const render = () => { display.textContent = expression || '0'; };
  const isDigit = (char) => /\d/.test(char || '');
  const isOperator = (char) => ['+', '-', '*', '/', '%'].includes(char);

  function clear() {
    expression = '';
    resultShown = false;
    hasError = false;
    render();
  }

  function deleteLast() {
    if (hasError || resultShown) return clear();
    expression = expression.slice(0, -1);
    render();
  }

  function appendDigit(char) {
    if (hasError || resultShown) clear();
    const tail = expression.match(/(?:\d*\.)?\d*$/)?.[0] ?? '';
    if (char === '.' && tail.includes('.')) return;
    if (char === '.' && (!tail || !isDigit(tail.at(-1)))) expression += '0';
    expression += char;
    render();
  }

  function appendOperator(operator) {
    if (hasError) clear();
    if (resultShown) resultShown = false;
    const last = expression.at(-1);
    if (!expression) {
      if (operator === '+' || operator === '-') expression = operator;
      render(); return;
    }
    if (last === '(') {
      if (operator === '+' || operator === '-') expression += operator;
      render(); return;
    }
    if (isOperator(last)) {
      const previous = expression.at(-2);
      if ((operator === '+' || operator === '-') && isOperator(last) && last !== '%') {
        if (last === '+' || last === '-') expression = expression.slice(0, -1) + operator;
        else if (last === '*' || last === '/' || last === '%') expression += operator;
      } else if ((last === '+' || last === '-') && isOperator(previous) && ['*', '/', '%'].includes(previous)) {
        expression = expression.slice(0, -2) + operator;
      } else {
        expression = expression.slice(0, -1) + operator;
      }
    } else expression += operator;
    render();
  }

  function appendParentheses() {
    if (hasError || resultShown) clear();
    const opens = (expression.match(/\(/g) || []).length;
    const closes = (expression.match(/\)/g) || []).length;
    const last = expression.at(-1);
    if (!expression || last === '(' || isOperator(last)) {
      expression += '(';
    } else if (opens > closes) {
      expression += ')';
    } else {
      if (isDigit(last) || last === ')') expression += '*';
      expression += '(';
    }
    render();
  }

  function tokenize(source) {
    const tokens = [];
    let i = 0;
    while (i < source.length) {
      const char = source[i];
      if (/\s/.test(char)) { i++; continue; }
      if (/[0-9.]/.test(char)) {
        let number = '', dots = 0;
        while (i < source.length && /[0-9.]/.test(source[i])) {
          if (source[i] === '.' && ++dots > 1) throw new Error('Invalid number');
          number += source[i++];
        }
        if (number === '.') throw new Error('Invalid number');
        tokens.push({ type: 'number', value: Number(number) });
      } else if ('+-*/%()'.includes(char)) {
        tokens.push({ type: char, value: char }); i++;
      } else throw new Error('Invalid character');
    }
    return tokens;
  }

  function evaluate(source) {
    // Omit unfinished binary operators; a trailing unary sign is unfinished too.
    source = source.replace(/[+*/%\-]+$/, '');
    if (!source) throw new Error('Empty expression');
    let tokens = tokenize(source);
    let depth = 0;
    for (const token of tokens) {
      if (token.type === '(') depth++;
      if (token.type === ')') { if (depth === 0) throw new Error('Unexpected close'); depth--; }
    }
    while (depth-- > 0) tokens.push({ type: ')', value: ')' });
    // Insert implicit multiplication, e.g. 2(3), (2)(3), and (2)3.
    const expanded = [];
    for (const token of tokens) {
      const previous = expanded.at(-1);
      if (previous && ((previous.type === 'number' || previous.type === ')') && token.type === '(' || previous.type === ')' && token.type === 'number')) {
        expanded.push({ type: '*', value: '*' });
      }
      expanded.push(token);
    }
    tokens = expanded;
    let position = 0;
    const peek = () => tokens[position]?.type;
    const consume = (type) => { if (peek() !== type) throw new Error('Unexpected token'); position++; };
    function parseExpression() {
      let value = parseTerm();
      while (peek() === '+' || peek() === '-') {
        const op = tokens[position++].type;
        const rhs = parseTerm();
        value = op === '+' ? value + rhs : value - rhs;
      }
      return value;
    }
    function parseTerm() {
      let value = parseUnary();
      while (peek() === '*' || peek() === '/' || peek() === '%') {
        const op = tokens[position++].type;
        const rhs = parseUnary();
        if ((op === '/' || op === '%') && rhs === 0) throw new Error('Division by zero');
        value = op === '*' ? value * rhs : op === '/' ? value / rhs : value % rhs;
      }
      return value;
    }
    function parseUnary() {
      if (peek() === '+') { consume('+'); return parseUnary(); }
      if (peek() === '-') { consume('-'); return -parseUnary(); }
      return parsePrimary();
    }
    function parsePrimary() {
      if (peek() === 'number') return tokens[position++].value;
      if (peek() === '(') {
        consume('(');
        const value = parseExpression();
        consume(')');
        return value;
      }
      throw new Error('Expected a number');
    }
    const answer = parseExpression();
    if (position !== tokens.length || !Number.isFinite(answer)) throw new Error('Invalid expression');
    return answer;
  }

  function calculate() {
    if (!expression || hasError) return;
    try {
      const answer = evaluate(expression);
      expression = Number.isInteger(answer) ? String(answer) : Number(answer.toPrecision(12)).toString();
      resultShown = true;
      hasError = false;
    } catch {
      expression = 'Error';
      resultShown = false;
      hasError = true;
    }
    render();
  }

  function input(value) {
    if (/^\d$/.test(value) || value === '.') appendDigit(value);
    else if (value === '()') appendParentheses();
    else if (isOperator(value)) appendOperator(value);
    else if (value === 'equals') calculate();
    else if (value === 'clear') clear();
    else if (value === 'delete') deleteLast();
  }

  keypad.addEventListener('click', (event) => {
    const button = event.target.closest('button');
    if (!button) return;
    input(button.dataset.action || button.dataset.value);
  });

  document.addEventListener('keydown', (event) => {
    const key = event.key;
    if (/^\d$/.test(key) || ['.', '+', '-', '*', '/', '%', '(', ')'].includes(key)) {
      event.preventDefault();
      if (key === '(' || key === ')') {
        if (hasError || resultShown) clear();
        const last = expression.at(-1);
        if (key === '(' && (isDigit(last) || last === ')')) expression += '*';
        expression += key;
        render();
      } else if (isOperator(key)) appendOperator(key);
      else appendDigit(key);
    } else if (key === 'Enter' || key === '=') {
      event.preventDefault(); calculate();
    } else if (key === 'Backspace') {
      event.preventDefault(); deleteLast();
    } else if (key === 'Escape') {
      event.preventDefault(); clear();
    }
  });

  render();
})();

