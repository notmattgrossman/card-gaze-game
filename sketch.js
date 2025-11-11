let bgImage;
let blueCard;
let redCard;
let flippedCard;

const COLS = 4;
const ROWS = 3;
const CARD_WIDTH = 90;
const CARD_HEIGHT = 135;
const CARD_SPACING_X = 120; // Horizontal spacing between columns
const CARD_SPACING_Y = 20; // Vertical spacing between rows
const HOVER_CIRCLE_RADIUS = 30; // Radius of the hover circle
const FILL_DURATION = 5000; // Fill duration in milliseconds (5 seconds)
const FLIP_DURATION = 300; // Flip animation duration in milliseconds (quicker)

let hoverStartTime = null;
let wasHovering = false;
let hoveredCardRow = null;
let hoveredCardCol = null;
let flippedCards = []; // Array to track flipped cards: [{row, col}, ...]
let flippingCards = []; // Array to track cards currently flipping: [{row, col, startTime}, ...]

function preload() {
    // Load the background image and card assets
    bgImage = loadImage('img/background.png');
    blueCard = loadImage('img/bluecard.png');
    redCard = loadImage('img/redcard.png');
    flippedCard = loadImage('img/flippedcard.png');
}

function setup() {
    createCanvas(1200, 600);
    pixelDensity(2);
}

// Check if mouse is over a card
function isMouseOverCard(mouseX, mouseY, cardX, cardY) {
    return mouseX >= cardX && mouseX <= cardX + CARD_WIDTH &&
           mouseY >= cardY && mouseY <= cardY + CARD_HEIGHT;
}

// Bezier easing function (ease-in-out cubic)
function bezierEase(t) {
    // Cubic bezier with control points for smooth ease-in-out
    // Using (0.42, 0, 0.58, 1) which is similar to ease-in-out
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
    
    // Draw the grid of cards
    for (let row = 0; row < ROWS; row++) {
        for (let col = 0; col < COLS; col++) {
            const x = startX + col * (CARD_WIDTH + CARD_SPACING_X);
            const y = startY + row * (CARD_HEIGHT + CARD_SPACING_Y);
            
            // Check if this card is flipped or flipping
            const isFlipped = flippedCards.some(card => card.row === row && card.col === col);
            const flippingCard = flippingCards.find(card => card.row === row && card.col === col);
            
            // Check if mouse is over this card (not flipped and not flipping)
            if (isMouseOverCard(mouseX, mouseY, x, y) && !isFlipped && !flippingCard) {
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
                
                if (flipProgress < 0.5) {
                    // First half: shrink horizontally (show card back)
                    scaleX = 1 - (flipProgress * 2); // Shrink from 1 to 0
                    showFlipped = false;
                } else {
                    // Second half: grow horizontally (show flipped card)
                    scaleX = ((flipProgress - 0.5) * 2); // Grow from 0 to 1
                    showFlipped = true;
                }
                
                // Draw the card with flip animation (2D perspective)
                push();
                translate(x + CARD_WIDTH / 2, y + CARD_HEIGHT / 2);
                scale(scaleX, 1); // Horizontal scale creates flip effect
                
                if (showFlipped) {
                    image(flippedCard, -CARD_WIDTH / 2, -CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT);
                } else {
                    // Alternate between blue and red (checkerboard pattern)
                    const isBlue = (row + col) % 2 === 0;
                    const cardImage = isBlue ? blueCard : redCard;
                    image(cardImage, -CARD_WIDTH / 2, -CARD_HEIGHT / 2, CARD_WIDTH, CARD_HEIGHT);
                }
                pop();
                
                // If animation is complete, mark as flipped
                if (flipProgress >= 1) {
                    flippedCards.push({row: row, col: col});
                    // Remove from flippingCards
                    const index = flippingCards.findIndex(card => 
                        card.row === row && card.col === col
                    );
                    if (index > -1) {
                        flippingCards.splice(index, 1);
                    }
                }
            } else if (isFlipped) {
                // Draw flipped card normally
                image(flippedCard, x, y, CARD_WIDTH, CARD_HEIGHT);
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
            // Check if card is not already flipped or flipping
            const alreadyFlipped = flippedCards.some(card => 
                card.row === hoveredCardRow && card.col === hoveredCardCol
            );
            const alreadyFlipping = flippingCards.some(card => 
                card.row === hoveredCardRow && card.col === hoveredCardCol
            );
            
            if (!alreadyFlipped && !alreadyFlipping) {
                // Start flip animation
                flippingCards.push({
                    row: hoveredCardRow, 
                    col: hoveredCardCol,
                    startTime: millis()
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
}

