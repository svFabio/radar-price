/**
 * Perceptual Image Hashing (dHash) and Similarity Matcher
 * 
 * Computes difference hashes to identify identical or re-uploaded photos
 * across Facebook Marketplace listings, preventing duplicate deal alerts.
 */

export class ImageHasher {
  /**
   * Computes a 64-bit hexadecimal difference hash (dHash) from an 8x9 or 9x8 intensity matrix.
   * If pixels are provided as flat numbers or rows, compares adjacent pixel intensities.
   */
  static computeDHashFromMatrix(matrix: number[][]): string {
    if (!matrix || matrix.length < 8) {
      throw new Error("Matrix must have at least 8 rows for dHash");
    }

    let binaryStr = "";
    for (let row = 0; row < 8; row++) {
      const cols = matrix[row];
      for (let col = 0; col < 8; col++) {
        const left = cols[col] ?? 0;
        const right = cols[col + 1] ?? 0;
        binaryStr += left > right ? "1" : "0";
      }
    }

    // Convert 64-bit binary string to 16-character hex string
    let hex = "";
    for (let i = 0; i < binaryStr.length; i += 4) {
      const chunk = binaryStr.slice(i, i + 4);
      hex += parseInt(chunk, 2).toString(16);
    }

    return hex.padStart(16, "0");
  }

  /**
   * Generates a deterministic perceptual fingerprint for an image URL or image buffer.
   * Extracts structural features or samples bytes to produce a 16-char hex hash.
   */
  static computeHashFromBuffer(buffer: Buffer): string {
    if (!buffer || buffer.length === 0) {
      return "0000000000000000";
    }

    // Sample an 8x9 grid of byte values from the buffer
    const matrix: number[][] = [];
    const step = Math.max(1, Math.floor(buffer.length / 72));

    for (let row = 0; row < 8; row++) {
      const rowValues: number[] = [];
      for (let col = 0; col < 9; col++) {
        const idx = (row * 9 + col) * step;
        rowValues.push(buffer[idx % buffer.length]);
      }
      matrix.push(rowValues);
    }

    return this.computeDHashFromMatrix(matrix);
  }

  /**
   * Calculates the Hamming distance between two 64-bit hexadecimal hashes.
   * Returns the count of differing bits (0 = exact match, <= 10 = highly similar).
   */
  static hammingDistance(hashA: string, hashB: string): number {
    if (hashA.length !== hashB.length) {
      // Normalize lengths if needed
      hashA = hashA.padStart(16, "0");
      hashB = hashB.padStart(16, "0");
    }

    let distance = 0;
    for (let i = 0; i < hashA.length; i++) {
      const valA = parseInt(hashA[i], 16);
      const valB = parseInt(hashB[i], 16);
      let xor = valA ^ valB;
      while (xor > 0) {
        distance += xor & 1;
        xor >>= 1;
      }
    }

    return distance;
  }

  /**
   * Returns true if two hashes represent perceptually similar images
   * within the specified maximum Hamming distance threshold (default 10 bits).
   */
  static areImagesSimilar(hashA: string, hashB: string, threshold: number = 10): boolean {
    return this.hammingDistance(hashA, hashB) <= threshold;
  }

  /**
   * Checks if any image in listing A is visually duplicate to any image in listing B.
   */
  static hasMatchingImage(hashesA: string[], hashesB: string[], threshold: number = 10): boolean {
    if (!hashesA?.length || !hashesB?.length) return false;

    for (const hA of hashesA) {
      for (const hB of hashesB) {
        if (this.areImagesSimilar(hA, hB, threshold)) {
          return true;
        }
      }
    }

    return false;
  }
}
