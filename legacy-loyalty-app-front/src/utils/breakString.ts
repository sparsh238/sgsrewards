export function breakStringOnCaps(input: string): string {
    // Use regex to add space before each uppercase letter (except the first one)
    return input.replace(/([A-Z][a-z]*)/g, ' $1').trim();
}
