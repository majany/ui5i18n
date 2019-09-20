export function computeRecommendedLength(text: string) : number {
	let tlength: number = 0;
	let enlength = text.length;

	// matrix for recommended length
	if (enlength >= 1 && enlength <= 4) {
		tlength = 10;
	}
	else if (enlength === 5) {
		tlength = 14;
	}
	else if (enlength === 6) {
		tlength = 16;
	}
	else if (enlength === 7) {
		tlength = 18;
	}
	else if (enlength >= 8 && enlength <= 10) {
		tlength = 20;
	}
	else if (enlength === 11) {
		tlength = 22;
	}
	else if (enlength === 12) {
		tlength = 24;
	}
	else if (enlength >= 13 && enlength <= 15) {
		tlength = 26;
	}
	else if (enlength === 16) {
		tlength = 28;
	}
	else if (enlength >= 17 && enlength <= 20) {
		tlength = 32;
	}
	else if (enlength >= 21 && enlength <= 80) {
		tlength = Math.round((enlength + enlength / 100 * 50));
	}
	else {
		tlength = Math.round((enlength + enlength / 100 * 30));
	}
	return tlength;
}