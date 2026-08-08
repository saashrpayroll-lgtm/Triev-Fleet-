import { parseIndianDate } from '../src/utils/dateUtils';

const testDates = [
    '12/02/2026',
    '3/9/2026 16:59',
    '7/3/2026 14:35',
    '28/02/2026 06:18:24 PM',
    '6/3/2026 12:29'
];

testDates.forEach(d => {
    console.log(`Original: ${d} -> Parsed: ${parseIndianDate(d)}`);
});
