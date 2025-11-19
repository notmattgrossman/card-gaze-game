import java.util.*;
import processing.sound.*;

final int COLS = 4;
final int ROWS = 3;
final int CARD_WIDTH = 90;
final int CARD_HEIGHT = 135;
final int CARD_SPACING_X = 120;
final int CARD_SPACING_Y = 20;
final int HOVER_CIRCLE_RADIUS = 30;
final int FILL_DURATION = 5000;
final int FLIP_DURATION = 300;
final int MISMATCH_DURATION = 1500;

PImage bgImage;
PImage blueCard;
PImage redCard;
PImage[] cardVariants;
int[][] cardAssignments;
PFont monoFont;
SoundFile flipSound;
SoundFile fanfareSound;

ArrayList<FlippedCard> flippedCards = new ArrayList<FlippedCard>();
ArrayList<FlippingCard> flippingCards = new ArrayList<FlippingCard>();
ArrayList<CardPos> matchedCards = new ArrayList<CardPos>();
ArrayList<ConfettiParticle> confettiParticles = new ArrayList<ConfettiParticle>();

long hoverStartTime = -1;
boolean wasHovering = false;
int hoveredCardRow = -1;
int hoveredCardCol = -1;
long mismatchStartTime = -1;
long gameStartTime = -1;
int totalFlips = 0;

String[] CARD_VARIANT_NAMES = {
  "brain",
  "diamond",
  "fire",
  "fish",
  "football",
  "money"
};

void setup() {
  size(1200, 600);
  pixelDensity(2);
  surface.setTitle("Z-Lab OCT Casino");
  
  bgImage = loadImage("background.png");
  blueCard = loadImage("bluecard.png");
  redCard = loadImage("redcard.png");
  
  cardVariants = new PImage[CARD_VARIANT_NAMES.length];
  for (int i = 0; i < CARD_VARIANT_NAMES.length; i++) {
    cardVariants[i] = loadImage(CARD_VARIANT_NAMES[i] + ".png");
  }
  
  cardAssignments = new int[ROWS][COLS];
  initializeCardAssignments();
  
  monoFont = createFont("Courier", 12, true);
  textFont(monoFont);
  
  flipSound = new SoundFile(this, "cardflip.mp3");
  fanfareSound = new SoundFile(this, "fanfare.mp3");
  
  gameStartTime = millis();
}

void draw() {
  image(bgImage, 0, 0, width, height);
  
  float totalGridWidth = (CARD_WIDTH * COLS) + (CARD_SPACING_X * (COLS - 1));
  float totalGridHeight = (CARD_HEIGHT * ROWS) + (CARD_SPACING_Y * (ROWS - 1));
  float paddingX = width * 0.15f;
  float paddingY = height * 0.12f;
  float startX = paddingX + (width - paddingX * 2 - totalGridWidth) / 2f;
  float startY = paddingY + (height - paddingY * 2 - totalGridHeight) / 2f;
  
  boolean isHoveringCard = false;
  int currentHoveredRow = -1;
  int currentHoveredCol = -1;
  
  if (mismatchStartTime >= 0 && flippedCards.size() == 2) {
    if (millis() - mismatchStartTime >= MISMATCH_DURATION) {
      FlippedCard card1 = flippedCards.get(0);
      FlippedCard card2 = flippedCards.get(1);
      
      flippingCards.add(new FlippingCard(card1.row, card1.col, millis(), true));
      playFlipSound();
      flippingCards.add(new FlippingCard(card2.row, card2.col, millis(), true));
      playFlipSound();
      
      flippedCards.clear();
      mismatchStartTime = -1;
    }
  }
  
  for (int row = 0; row < ROWS; row++) {
    for (int col = 0; col < COLS; col++) {
      float x = startX + col * (CARD_WIDTH + CARD_SPACING_X);
      float y = startY + row * (CARD_HEIGHT + CARD_SPACING_Y);
      boolean matched = isMatched(row, col);
      boolean currentlyFlipped = isCurrentlyFlipped(row, col);
      FlippingCard flippingCard = getFlippingCard(row, col);
      
      if (isMouseOverCard(mouseX, mouseY, x, y) &&
          !matched &&
          flippingCard == null &&
          !currentlyFlipped &&
          flippedCards.size() < 2) {
        isHoveringCard = true;
        currentHoveredRow = row;
        currentHoveredCol = col;
      }
      
      if (flippingCard != null) {
        float flipElapsed = millis() - flippingCard.startTime;
        float rawProgress = constrain(flipElapsed / FLIP_DURATION, 0, 1);
        float flipProgress = bezierEase(rawProgress);
        float scaleX;
        boolean showFlipped;
        
        if (flippingCard.isFlippingBack) {
          if (flipProgress < 0.5f) {
            scaleX = 1 - (flipProgress * 2);
            showFlipped = true;
          } else {
            scaleX = (flipProgress - 0.5f) * 2;
            showFlipped = false;
          }
        } else {
          if (flipProgress < 0.5f) {
            scaleX = 1 - (flipProgress * 2);
            showFlipped = false;
          } else {
            scaleX = (flipProgress - 0.5f) * 2;
            showFlipped = true;
          }
        }
        
        pushMatrix();
        translate(x + CARD_WIDTH / 2f, y + CARD_HEIGHT / 2f);
        scale(max(scaleX, 0.001f), 1);
        
        if (showFlipped) {
          int variantIndex = cardAssignments[row][col];
          image(cardVariants[variantIndex], -CARD_WIDTH / 2f, -CARD_HEIGHT / 2f, CARD_WIDTH, CARD_HEIGHT);
        } else {
          boolean isBlue = (row + col) % 2 == 0;
          PImage cardImage = isBlue ? blueCard : redCard;
          image(cardImage, -CARD_WIDTH / 2f, -CARD_HEIGHT / 2f, CARD_WIDTH, CARD_HEIGHT);
        }
        popMatrix();
        
        if (flipProgress >= 1) {
          if (flippingCard.isFlippingBack) {
            removeFromFlipped(row, col);
          } else {
            int variantIndex = cardAssignments[row][col];
            flippedCards.add(new FlippedCard(row, col, variantIndex));
            totalFlips++;
            
            if (flippedCards.size() == 2) {
              FlippedCard card1 = flippedCards.get(0);
              FlippedCard card2 = flippedCards.get(1);
              if (card1.variantIndex == card2.variantIndex) {
                matchedCards.add(new CardPos(card1.row, card1.col));
                matchedCards.add(new CardPos(card2.row, card2.col));
                
                float card1X = startX + card1.col * (CARD_WIDTH + CARD_SPACING_X) + CARD_WIDTH / 2f;
                float card1Y = startY + card1.row * (CARD_HEIGHT + CARD_SPACING_Y) + CARD_HEIGHT / 2f;
                float card2X = startX + card2.col * (CARD_WIDTH + CARD_SPACING_X) + CARD_WIDTH / 2f;
                float card2Y = startY + card2.row * (CARD_HEIGHT + CARD_SPACING_Y) + CARD_HEIGHT / 2f;
                createConfetti(card1X, card1Y);
                createConfetti(card2X, card2Y);
                playFanfare();
                flippedCards.clear();
              } else {
                mismatchStartTime = millis();
              }
            }
          }
          flippingCards.remove(flippingCard);
        }
      } else if (matched) {
        int variantIndex = cardAssignments[row][col];
        image(cardVariants[variantIndex], x, y, CARD_WIDTH, CARD_HEIGHT);
        noStroke();
        fill(0, 128);
        rect(x, y, CARD_WIDTH, CARD_HEIGHT);
      } else if (currentlyFlipped) {
        int variantIndex = cardAssignments[row][col];
        image(cardVariants[variantIndex], x, y, CARD_WIDTH, CARD_HEIGHT);
      } else {
        boolean isBlue = (row + col) % 2 == 0;
        PImage cardImage = isBlue ? blueCard : redCard;
        image(cardImage, x, y, CARD_WIDTH, CARD_HEIGHT);
      }
    }
  }
  
  if (isHoveringCard && currentHoveredRow >= 0 && currentHoveredCol >= 0) {
    noCursor();
    boolean sameCard = (hoveredCardRow == currentHoveredRow && hoveredCardCol == currentHoveredCol);
    if (!wasHovering || !sameCard) {
      hoverStartTime = millis();
      hoveredCardRow = currentHoveredRow;
      hoveredCardCol = currentHoveredCol;
    }
    float elapsed = millis() - hoverStartTime;
    float fillProgress = constrain(elapsed / FILL_DURATION, 0, 1);
    float cardX = startX + currentHoveredCol * (CARD_WIDTH + CARD_SPACING_X) + CARD_WIDTH / 2f;
    float cardY = startY + currentHoveredRow * (CARD_HEIGHT + CARD_SPACING_Y) + CARD_HEIGHT / 2f;
    
    stroke(255, 200);
    strokeWeight(2);
    noFill();
    ellipse(cardX, cardY, HOVER_CIRCLE_RADIUS * 2, HOVER_CIRCLE_RADIUS * 2);
    
    if (fillProgress > 0) {
      noStroke();
      fill(255, 150);
      float innerRadius = HOVER_CIRCLE_RADIUS * (1 - fillProgress);
      ellipse(cardX, cardY, max(innerRadius * 2, 2), max(innerRadius * 2, 2));
    }
    
    if (fillProgress >= 1) {
      if (!isCurrentlyFlipped(hoveredCardRow, hoveredCardCol) &&
          getFlippingCard(hoveredCardRow, hoveredCardCol) == null &&
          !isMatched(hoveredCardRow, hoveredCardCol) &&
          flippedCards.size() < 2) {
        flippingCards.add(new FlippingCard(hoveredCardRow, hoveredCardCol, millis(), false));
        playFlipSound();
      }
      resetHover();
    } else {
      wasHovering = true;
    }
  } else {
    cursor();
    resetHover();
  }
  
  for (int i = confettiParticles.size() - 1; i >= 0; i--) {
    ConfettiParticle particle = confettiParticles.get(i);
    particle.update();
    particle.draw();
    if (particle.isDead()) {
      confettiParticles.remove(i);
    }
  }
  
  if (gameStartTime >= 0) {
    int elapsedTime = (int)(millis() - gameStartTime);
    String timeString = formatTime(elapsedTime);
    textFont(monoFont, 12);
    textAlign(LEFT, TOP);
    fill(255, 255, 0);
    text(timeString, 20, 20);
  }
  
  textFont(monoFont, 12);
  textLeading(14);
  textAlign(RIGHT, TOP);
  fill(255, 255, 0);
  text("Cards Flipped: " + totalFlips, width - 20, 20);
  text("Matches: " + (matchedCards.size() / 2), width - 20, 34);
  
  textAlign(CENTER, BOTTOM);
  text("Z-Lab OCT Casino", width / 2f, height - 10);
}

void resetHover() {
  hoverStartTime = -1;
  hoveredCardRow = -1;
  hoveredCardCol = -1;
  wasHovering = false;
}

boolean isMouseOverCard(float mx, float my, float x, float y) {
  return mx >= x && mx <= x + CARD_WIDTH && my >= y && my <= y + CARD_HEIGHT;
}

boolean isMatched(int row, int col) {
  for (CardPos pos : matchedCards) {
    if (pos.row == row && pos.col == col) {
      return true;
    }
  }
  return false;
}

boolean isCurrentlyFlipped(int row, int col) {
  for (FlippedCard card : flippedCards) {
    if (card.row == row && card.col == col) {
      return true;
    }
  }
  return false;
}

FlippingCard getFlippingCard(int row, int col) {
  for (FlippingCard card : flippingCards) {
    if (card.row == row && card.col == col) {
      return card;
    }
  }
  return null;
}

void removeFromFlipped(int row, int col) {
  for (int i = flippedCards.size() - 1; i >= 0; i--) {
    FlippedCard card = flippedCards.get(i);
    if (card.row == row && card.col == col) {
      flippedCards.remove(i);
      return;
    }
  }
}

void initializeCardAssignments() {
  IntList indices = new IntList();
  for (int i = 0; i < CARD_VARIANT_NAMES.length; i++) {
    indices.append(i);
    indices.append(i);
  }
  indices.shuffle();
  int idx = 0;
  for (int row = 0; row < ROWS; row++) {
    for (int col = 0; col < COLS; col++) {
      cardAssignments[row][col] = indices.get(idx++);
    }
  }
}

String formatTime(int milliseconds) {
  int totalSeconds = milliseconds / 1000;
  int minutes = totalSeconds / 60;
  int seconds = totalSeconds % 60;
  return nf(minutes, 2) + ":" + nf(seconds, 2);
}

float bezierEase(float t) {
  if (t < 0.5f) {
    return 4 * t * t * t;
  } else {
    float u = -2 * t + 2;
    return 1 - (u * u * u) / 2f;
  }
}

class CardPos {
  int row;
  int col;
  CardPos(int row, int col) {
    this.row = row;
    this.col = col;
  }
}

class FlippedCard {
  int row;
  int col;
  int variantIndex;
  FlippedCard(int row, int col, int variantIndex) {
    this.row = row;
    this.col = col;
    this.variantIndex = variantIndex;
  }
}

class FlippingCard {
  int row;
  int col;
  float startTime;
  boolean isFlippingBack;
  FlippingCard(int row, int col, float startTime, boolean isFlippingBack) {
    this.row = row;
    this.col = col;
    this.startTime = startTime;
    this.isFlippingBack = isFlippingBack;
  }
}

class ConfettiParticle {
  float x;
  float y;
  float vx;
  float vy;
  float rotation;
  float rotationSpeed;
  float size;
  float life = 1.0f;
  float decay;
  int c;
  ConfettiParticle(float x, float y) {
    this.x = x;
    this.y = y;
    this.vx = random(-3, 3);
    this.vy = random(-8, -2);
    this.rotation = random(TWO_PI);
    this.rotationSpeed = random(-0.1f, 0.1f);
    this.size = random(4, 8);
    this.decay = random(0.01f, 0.02f);
    this.c = color(random(255), random(255), random(255), 200);
  }
  void update() {
    x += vx;
    y += vy;
    vy += 0.3f;
    rotation += rotationSpeed;
    life -= decay;
  }
  void draw() {
    pushMatrix();
    translate(x, y);
    rotate(rotation);
    noStroke();
    fill(red(c), green(c), blue(c), life * 200);
    rect(-size / 2f, -size / 2f, size, size);
    popMatrix();
  }
  boolean isDead() {
    return life <= 0 || y > height + 50;
  }
}

void createConfetti(float x, float y) {
  int particleCount = 30;
  for (int i = 0; i < particleCount; i++) {
    confettiParticles.add(new ConfettiParticle(x, y));
  }
}

void playFlipSound() {
  if (flipSound != null) {
    flipSound.stop();
    flipSound.play();
  }
}

void playFanfare() {
  if (fanfareSound != null) {
    fanfareSound.stop();
    fanfareSound.play();
  }
}
