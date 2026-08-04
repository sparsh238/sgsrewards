/**
 * Formats a number according to the Indian number system.
 * @param number - The number to format.
 * @returns The formatted number as a string.
 */
export const formatNumber = (number: number): string => {
    return number.toLocaleString('en-IN');
};

export const parseFormattedNumber = (formattedString: string): number => {
    // Remove all commas from the formatted string
    const cleanedString = formattedString.replace(/,/g, '');
    // Convert the cleaned string to a number
    const originalNumber = Number(cleanedString);

    // Return the number or NaN if the conversion fails
    return isNaN(originalNumber) ? NaN : originalNumber;
};