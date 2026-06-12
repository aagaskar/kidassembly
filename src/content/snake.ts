/**
 * Snake (§4 Unit 15): the capstone game, in MiniC on BitBot-16.
 * Steering: W/A/S/D through the KEY box (3072); pacing through TICK (3074);
 * food placement through RANDOM (3073). The hot path avoids multiplies —
 * the snake lives in screen OFFSETS (0–1023) and moves by ±1 / ±32.
 */
export const SNAKE_MINIC = `// SNAKE — steer with W A S D (click the key box first!)
// Run at full speed. Eat the bright food, don't bite yourself.

char* screen = (char*)2048;
char* keybox = (char*)3072;
char* tick   = (char*)3074;
char* random = (char*)3073;

int body[200];
int len;
int dir;
int food;

int findFood() {
  int p = *random * 4;
  while (*(screen + p) != 0) {
    p = (p + 7) % 1024;
  }
  return p;
}

void restart() {
  for (int i = 0; i < 1024; i = i + 1) {
    *(screen + i) = 0;
  }
  len = 3;
  dir = 1;
  body[0] = 35; body[1] = 34; body[2] = 33;
  *(screen + 35) = 3;
  *(screen + 34) = 3;
  *(screen + 33) = 3;
  food = findFood();
  *(screen + food) = 12;
}

int main() {
  restart();
  while (1) {
    // wait for the next clock tick (the TICK box is just memory)
    int t = *tick;
    while (*tick == t) { }

    // steering: read the KEY box, then clear it
    int k = *keybox;
    if (k == 87) { if (dir != 32)  { dir = 0 - 32; } }   // W = up
    if (k == 83) { if (dir != 0 - 32) { dir = 32; } }    // S = down
    if (k == 65) { if (dir != 1)   { dir = 0 - 1; } }    // A = left
    if (k == 68) { if (dir != 0 - 1) { dir = 1; } }      // D = right
    *keybox = 0;

    // new head, wrapping at the screen edges
    int head = body[0] + dir;
    if (head < 0) { head = head + 1024; }
    if (head >= 1024) { head = head - 1024; }

    int ate = 0;
    if (head == food) { ate = 1; }
    if (*(screen + head) == 3) { restart(); }
    else {
      if (ate == 0) {
        *(screen + body[len - 1]) = 0;   // erase tail
      } else {
        if (len < 199) { len = len + 1; }
      }
      for (int i = len - 1; i > 0; i = i - 1) {
        body[i] = body[i - 1];
      }
      body[0] = head;
      *(screen + head) = 3;
      if (ate == 1) {
        food = findFood();
        *(screen + food) = 12;
      }
    }
  }
  return 0;
}
`;
