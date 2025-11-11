let bgImage;
let blueCard;
let redCard;
let cardVariants = []; // Array to hold all 6 card variant images
let cardAssignments = []; // 2D array: cardAssignments[row][col] = variant index

const COLS = 4;
const ROWS = 3;
const CARD_WIDTH = 90;
const CARD_HEIGHT = 135;
const CARD_SPACING_X = 120; // Horizontal spacing between columns
const CARD_SPACING_Y = 20; // Vertical spacing between rows
const HOVER_CIRCLE_RADIUS = 30; // Radius of the hover circle
const FILL_DURATION = 5000; // Fill duration in milliseconds (5 seconds)
const FLIP_DURATION = 300; // Flip animation duration in milliseconds
const MISMATCH_DURATION = 1500; // Time to show mismatched cards before flipping back

let hoverStartTime = null;
let wasHovering = false;
let hoveredCardRow = null;
let hoveredCardCol = null;
let flippedCards = []; // Array of currently flipped cards: [{row, col, variantIndex, flipTime}, ...]
let flippingCards = []; // Array of cards currently flipping: [{row, col, startTime, isFlippingBack}, ...]
let matchedCards = []; // Array of matched cards: [{row, col}, ...]
let mismatchStartTime = null; // Time when mismatch was detected
let confettiParticles = []; // Array of confetti particles
let gameStartTime = null; // Time when game started
let totalFlips = 0; // Total number of card flips

// Card variant filenames
const CARD_VARIANT_NAMES = ['brain', 'diamond', 'fire', 'fish', 'football', 'money'];

function preload() {
    // Load the background image and card assets
    bgImage = loadImage('img/background.png');
    blueCard = loadImage('img/bluecard.png');
    redCard = loadImage('img/redcard.png');
    
    // Load all 6 card variants
    for (let i = 0; i < CARD_VARIANT_NAMES.length; i++) {
        cardVariants.push(loadImage(`img/${CARD_VARIANT_NAMES[i]}.png`));
    }
}

function setup() {
    createCanvas(1200, 600);
    pixelDensity(2);
    
    // Initialize card assignments array
    initializeCardAssignments();
    
    // Start game timer
    gameStartTime = millis();
}

// Initialize card assignments: 2 of each variant randomly placed
function initializeCardAssignments() {
    cardAssignments = [];
    
    // Create array with 2 of each variant (12 cards total)
    let variantIndices = [];
    for (let i = 0; i < CARD_VARIANT_NAMES.length; i++) {
        variantIndices.push(i, i); // Add each variant twice
    }
    
    // Shuffle the array
    for (let i = variantIndices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [variantIndices[i], variantIndices[j]] = [variantIndices[j], variantIndices[i]];
    }
    
    // Assign to grid
    let index = 0;
    for (let row = 0; row < ROWS; row++) {
        cardAssignments[row] = [];
        for (let col = 0; col < COLS; col++) {
            cardAssignments[row][col] = variantIndices[index++];
        }
    }
}

// Check if mouse is over a card
function isMouseOverCard(mouseX, mouseY, cardX, cardY) {
    return mouseX >= cardX && mouseX <= cardX + CARD_WIDTH &&
           mouseY >= cardY && mouseY <= cardY + CARD_HEIGHT;
}

// Check if a card is matched
function isMatched(row, col) {
    return matchedCards.some(card => card.row === row && card.col === col);
}

// Check if a card is currently flipped (not matched, but showing face)
function isCurrentlyFlipped(row, col) {
    return flippedCards.some(card => card.row === row && card.col === col);
}

// Check if a card is flipping
function isFlipping(row, col) {
    return flippingCards.some(card => card.row === row && card.col === col);
}

// Confetti Particle class
class ConfettiParticle {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = random(-3, 3);
        this.vy = random(-8, -2);
        this.rotation = random(0, TWO_PI);
        this.rotationSpeed = random(-0.1, 0.1);
        this.size = random(4, 8);
        this.color = color(
            random(255),
            random(255),
            random(255),
            200
        );
        this.life = 1.0;
        this.decay = random(0.01, 0.02);
    }
    
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.3; // Gravity
        this.rotation += this.rotationSpeed;
        this.life -= this.decay;
    }
    
    draw() {
        push();
        translate(this.x, this.y);
        rotate(this.rotation);
        fill(red(this.color), green(this.color), blue(this.color), this.life * 200);
        noStroke();
        rect(-this.size / 2, -this.size / 2, this.size, this.size);
        pop();
    }
    
    isDead() {
        return this.life <= 0 || this.y > height + 50;
    }
}

// Create confetti explosion at a position
function createConfetti(x, y) {
    const particleCount = 30;
    for (let i = 0; i < particleCount; i++) {
        confettiParticles.push(new ConfettiParticle(x, y));
    }
}

// Format timer as MM:SS
function formatTime(milliseconds) {
    const totalSeconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

// Bezier easing function (ease-in-out cubic)
function bezierEase(t) {
    return t < 0.5 
        ? 4 * t * t * t  // ease-in
        : 1 - Math.pow(-2 * t + 2, 3) / 2; // ease-out
}

function draw() {
    // Draw the background image scaled to fit the canvas
    image(bgImage, 0, 0, width, height);
    
    // Calculate grid dimensions
    const totalGridWidth = (CARD_WIDTH * COLS) + (CARD_SPACING_X * (COLS - 1));
    const totalGridHeight = (CARD_HEIGHT * ROWS) + (CARD_SPACING_Y * (ROWS - 1));
    
    // Add padding to fit within the central green area
    const paddingX = width * 0.15; // 15% padding on sides
    const paddingY = height * 0.12; // 12% padding on top/bottom
    
    // Calculate starting position to center the grid within the central green area
    const startX = paddingX + (width - paddingX * 2 - totalGridWidth) / 2;
    const startY = paddingY + (height - paddingY * 2 - totalGridHeight) / 2;
    
    let isHoveringCard = false;
    let currentHoveredRow = null;
    let currentHoveredCol = null;
    
    // Handle mismatch timing
    if (mismatchStartTime !== null && flippedCards.length === 2) {
        const elapsed = millis() - mismatchStartTime;
        if (elapsed >= MISMATCH_DURATION) {
            // Flip both cards back
            const card1 = flippedCards[0];
            const card2 = flippedCards[1];
            
            flippingCards.push({
                row: card1.row,
                col: card1.col,
                startTime: millis(),
                isFlippingBack: true
            });
            flippingCards.push({
                row: card2.row,
                col: card2.col,
                startTime: millis(),
                isFlippingBack: true
            });
            
            flippedCards = [];
            mismatchStartTime = null;
        }
    }
    
    // Draw the grid of cards
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            const x = startX + col * (CARD_WIDTH + CARD_SPACING_X);
            const y = startY + row * (CARD_HEIGHT + CARD_SPACING_Y);
            
            const matched = isMatched(row, col);
            const currentlyFlipped = isCurrentlyFlipped(row, col);
            const flippingCard = flippingCards.find(card => card.row === row && card.col === col);
            
            // Check if mouse is over this card (can only hover if not matched, not flipping, not flipped, and < 2 cards flipped)
            if (isMouseOverCard(mouseX, mouseY, x, y) && 
                !matched && 
                !flippingCard && 
                !currentlyFlipped &&
                flippedCards.length < 2) {
                isHoveringCard = true;
                currentHoveredRow = row;
                currentHoveredCol = col;
            }
            
            // Draw the card with animation if flipping
            if (flippingCard) {
                const flipElapsed = millis() - flippingCard.startTime;
                const rawProgress = min(flipElapsed / FLIP_DURATION, 1);
                
                // Apply bezier easing curve
                const flipProgress = bezierEase(rawProgress);
                
                // Calculate scale and which side to show
                let scaleX = 1;
                let showFlipped = false;
                
                if (flippingCard.isFlippingBack) {
                    // Flipping back: show face first, then back
                    if (flipProgress < 0.5) {
                        scaleX = 1 - (flipProgress * 2); // Shrink from 1 to 0
                        showFlipped = true;
                    } else {
                        scaleX = ((flipProgress - 0.5) * 2); // Grow from 0 to 1
                        showFlipped = false;
                    }
                } else {
                    // Flipping forward: show back first, then face
                    if (flipProgress < 0.5) {
                        scaleX = 1 - (flipProgress * 2); // Shrink from 1 to 0
                        showFlipped = false;
                    } else {
                        scaleX = ((flipProgress - 0.5) * 2); // Grow from 0 to 1
                        showFlipped = true;
                    }
                }
                
                // Draw the card with flip animation (2D perspective)
                push();
                translate(x + CARD_WIDTH / 2, y + CARD_HEIGHT / 2);
                scale(scaleX, 1); // Horizontal scale creates flip effect
                
                if (showFlipped) {
                    const variantIndex = cardAssignments[row][col];
                    image(cardVariants[variantIndex], -CARD_WIDTH / 2, -CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT);
                } else {
                    // Alternate between blue and red (checkerboard pattern)
                    const isBlue = (row + col) % 2 === 0;
                    const cardImage = isBlue ? blueCard : redCard;
                    image(cardImage, -CARD_WIDTH / 2, -CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT);
                }
                pop();
                
                // If animation is complete
                if (flipProgress >= 1) {
                    if (flippingCard.isFlippingBack) {
                        // Card is now flipped back, remove from flippedCards if it was there
                        const index = flippedCards.findIndex(card => 
                            card.row === row && card.col === col
                        );
                        if (index > -1) {
                            flippedCards.splice(index, 1);
                        }
                    } else {
                        // Card is now flipped forward, add to flippedCards
                        const variantIndex = cardAssignments[row][col];
                        flippedCards.push({
                            row: row,
                            col: col,
                            variantIndex: variantIndex,
                            flipTime: millis()
                        });
                        
                        // Increment total flips counter
                        totalFlips++;
                        
                        // Check for match if 2 cards are flipped
                        if (flippedCards.length === 2) {
                            const card1 = flippedCards[0];
                            const card2 = flippedCards[1];
                            
                            if (card1.variantIndex === card2.variantIndex) {
                                // Match! Mark as matched
                                matchedCards.push({row: card1.row, col: card1.col});
                                matchedCards.push({row: card2.row, col: card2.col});
                                
                                // Create confetti at both card positions
                                const card1X = startX + card1.col * (CARD_WIDTH + CARD_SPACING_X) + CARD_WIDTH / 2;
                                const card1Y = startY + card1.row * (CARD_HEIGHT + CARD_SPACING_Y) + CARD_HEIGHT / 2;
                                const card2X = startX + card2.col * (CARD_WIDTH + CARD_SPACING_X) + CARD_WIDTH / 2;
                                const card2Y = startY + card2.row * (CARD_HEIGHT + CARD_SPACING_Y) + CARD_HEIGHT / 2;
                                
                                createConfetti(card1X, card1Y);
                                createConfetti(card2X, card2Y);
                                
                                flippedCards = [];
                            } else {
                                // Mismatch! Start timer to flip back
                                mismatchStartTime = millis();
                            }
                        }
                    }
                    
                    // Remove from flippingCards
                    const index = flippingCards.findIndex(card => 
                        card.row === row && card.col === col
                    );
                    if (index > -1) {
                        flippingCards.splice(index, 1);
                    }
                }
            } else if (matched) {
                // Draw matched card with gray overlay (50% transparent black)
                const variantIndex = cardAssignments[row][col];
                image(cardVariants[variantIndex], x, y, CARD_WIDTH, CARD_HEIGHT);
                
                // Draw semi-transparent black overlay to gray out the card
                fill(0, 0, 0, 128); // 50% transparent black (128/255)
                noStroke();
                rect(x, y, CARD_WIDTH, CARD_HEIGHT);
            } else if (currentlyFlipped) {
                // Draw flipped card (showing face)
                const variantIndex = cardAssignments[row][col];
                image(cardVariants[variantIndex], x, y, CARD_WIDTH, CARD_HEIGHT);
            } else {
                // Draw normal card back
                const isBlue = (row + col) % 2 === 0;
                const cardImage = isBlue ? blueCard : redCard;
                image(cardImage, x, y, CARD_WIDTH, CARD_HEIGHT);
            }
        }
    }
    
    // Draw hover circle if hovering over a card
    if (isHoveringCard && currentHoveredRow !== null && currentHoveredCol !== null) {
        // Hide cursor when hovering over a card
        noCursor();
        
        // Check if we're hovering over the same card as before
        const sameCard = (hoveredCardRow === currentHoveredRow && hoveredCardCol === currentHoveredCol);
        
        // Start tracking hover time if just started hovering or switched cards
        if (!wasHovering || !sameCard) {
            hoverStartTime = millis();
            hoveredCardRow = currentHoveredRow;
            hoveredCardCol = currentHoveredCol;
        }
        
        // Calculate fill progress (0 to 1 over 5 seconds)
        const elapsedTime = millis() - hoverStartTime;
        const fillProgress = min(elapsedTime / FILL_DURATION, 1);
        
        // If fill is complete, start flip animation
        if (fillProgress >= 1) {
            // Check if card is not already flipped, flipping, or matched
            const alreadyFlipped = isCurrentlyFlipped(hoveredCardRow, hoveredCardCol);
            const alreadyFlipping = isFlipping(hoveredCardRow, hoveredCardCol);
            const alreadyMatched = isMatched(hoveredCardRow, hoveredCardCol);
            
            if (!alreadyFlipped && !alreadyFlipping && !alreadyMatched && flippedCards.length < 2) {
                // Start flip animation
                flippingCards.push({
                    row: hoveredCardRow, 
                    col: hoveredCardCol,
                    startTime: millis(),
                    isFlippingBack: false
                });
            }
            // Reset hover state for this card
            hoverStartTime = null;
            hoveredCardRow = null;
            hoveredCardCol = null;
            wasHovering = false;
        } else {
            // Calculate the center position of the hovered card
            const cardX = startX + currentHoveredCol * (CARD_WIDTH + CARD_SPACING_X);
            const cardY = startY + currentHoveredRow * (CARD_HEIGHT + CARD_SPACING_Y);
            const cardCenterX = cardX + CARD_WIDTH / 2;
            const cardCenterY = cardY + CARD_HEIGHT / 2;
            
            // Draw the fill from outside in first
            if (fillProgress > 0) {
                // Fill from outside in: draw a ring that shrinks from outer edge toward center
                // The filled area grows as the inner radius shrinks
                const innerRadius = HOVER_CIRCLE_RADIUS * (1 - fillProgress);
                
                push();
                translate(cardCenterX, cardCenterY);
                fill(255, 255, 255, 150); // Semi-transparent white fill
                noStroke();
                
                // Draw ring using drawingContext arc for perfect ring
                if (innerRadius > 0) {
                    drawingContext.beginPath();
                    // Outer circle
                    drawingContext.arc(0, 0, HOVER_CIRCLE_RADIUS, 0, TWO_PI);
                    // Inner circle (counter-clockwise to create hole)
                    drawingContext.arc(0, 0, innerRadius, 0, TWO_PI, true);
                    drawingContext.fill();
                } else {
                    // Fully filled - just draw a circle with same transparency
                    fill(255, 255, 255, 150);
                    circle(0, 0, HOVER_CIRCLE_RADIUS * 2);
                }
                pop();
            }
            
            wasHovering = true;
        }
    } else {
        // Show cursor when not hovering over a card
        cursor();
        
        // Reset hover tracking when not hovering
        hoverStartTime = null;
        hoveredCardRow = null;
        hoveredCardCol = null;
        wasHovering = false;
    }
    
    // Update and draw confetti particles
    for (let i = confettiParticles.length - 1; i >= 0; i--) {
        const particle = confettiParticles[i];
        particle.update();
        particle.draw();
        
        if (particle.isDead()) {
            confettiParticles.splice(i, 1);
        }
    }
    
    // Display timer in top left
    if (gameStartTime !== null) {
        const elapsedTime = millis() - gameStartTime;
        const timeString = formatTime(elapsedTime);
        
        push();
        textFont('monospace');
        textSize(12);
        textStyle(BOLD);
        fill(255, 255, 0); // Yellow
        textAlign(LEFT, TOP);
        text(timeString, 20, 20);
        pop();
    }
    
    // Display stats in top right
    const cardsFlipped = totalFlips;
    const matches = matchedCards.length / 2;
    
    push();
    textFont('monospace');
    textSize(12);
    textLeading(14); // Reduce line height
    textStyle(BOLD);
    fill(255, 255, 0); // Yellow
    textAlign(RIGHT, TOP);
    text(`Cards Flipped: ${cardsFlipped}`, width - 20, 20);
    text(`Matches: ${matches}`, width - 20, 20 + 14); // Use reduced line height
    pop();
    
    // Display Z-Lab OCT Casino at bottom center
    push();
    textFont('monospace');
    textSize(12);
    fill(255, 255, 0); // Yellow
    textAlign(CENTER, BOTTOM);
    text('Z-Lab OCT Casino', width / 2, height - 10);
    pop();
}
