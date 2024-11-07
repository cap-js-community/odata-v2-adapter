describe("data extraction", () => {
  const extractionPatterns = require("../src/lib/extraction-patterns");

  it("should extract simple datetime", () => {
    // Arrange
    const sut = extractionPatterns.dateTime;
    const sampleDate = "datetime'20240501'";
    
    // Act
    const result = sampleDate.replace(sut, "$1");

    // Assert
    expect(result).toBe("20240501");
  });

  it("should extract encoded datetime", () => {
    // Arrange
    const sut = extractionPatterns.dateTime;
    const sampleDate = "datetime%2720240501%27";
    
    // Act
    const result = sampleDate.replace(sut, "$1");

    // Assert
    expect(result).toBe("20240501");
  });
});
