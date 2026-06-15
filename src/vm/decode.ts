import { configOf, Op, VMState } from "./types";

export interface OpInfo {
  mnemonic: string;
  hasOperand: boolean;
  /** Plain-language template; `$n` is replaced with the operand. */
  describe: (operand: number) => string;
  /** Syntax shown in the reference card, e.g. "ADD b" or "HALT". */
  usage: string;
  /** Generic, operand-free description for the reference card. */
  summary: string;
}

export const OP_INFO: Record<number, OpInfo> = {
  [Op.HALT]: {
    mnemonic: "HALT",
    hasOperand: false,
    describe: () => "Stop the machine.",
    usage: "HALT",
    summary: "Stop the machine.",
  },
  [Op.LOADC]: {
    mnemonic: "LOADC",
    hasOperand: true,
    describe: (n) => `Put the number ${n} into A.`,
    usage: "LOADC n",
    summary: "Put the number n into A.",
  },
  [Op.LOAD]: {
    mnemonic: "LOAD",
    hasOperand: true,
    describe: (n) => `Copy what's in box ${n} into A.`,
    usage: "LOAD b",
    summary: "Copy what's in box b into A.",
  },
  [Op.STORE]: {
    mnemonic: "STORE",
    hasOperand: true,
    describe: (n) => `Copy A into box ${n}.`,
    usage: "STORE b",
    summary: "Copy A into box b.",
  },
  [Op.ADD]: {
    mnemonic: "ADD",
    hasOperand: true,
    describe: (n) => `Add the number in box ${n} to A.`,
    usage: "ADD b",
    summary: "Add the number in box b to A.",
  },
  [Op.SUB]: {
    mnemonic: "SUB",
    hasOperand: true,
    describe: (n) => `Subtract the number in box ${n} from A.`,
    usage: "SUB b",
    summary: "Subtract the number in box b from A.",
  },
  [Op.JUMP]: {
    mnemonic: "JUMP",
    hasOperand: true,
    describe: (n) => `Jump: the next instruction comes from box ${n}.`,
    usage: "JUMP a",
    summary: "Jump: the next instruction comes from box a.",
  },
  [Op.JZ]: {
    mnemonic: "JZ",
    hasOperand: true,
    describe: (n) => `If A is 0, jump to box ${n}. Otherwise keep going.`,
    usage: "JZ a",
    summary: "If A is 0, jump to box a. Otherwise keep going.",
  },
  [Op.JNEG]: {
    mnemonic: "JNEG",
    hasOperand: true,
    describe: (n) => `If A's top bit is 1 (negative), jump to box ${n}.`,
    usage: "JNEG a",
    summary: "If A is negative, jump to box a.",
  },
  [Op.LOADP]: {
    mnemonic: "LOADP",
    hasOperand: true,
    describe: (n) => `Follow the arrow: box ${n} holds an address — copy what's in THAT box into A.`,
    usage: "LOADP b",
    summary: "Box b holds an address — copy what's in THAT box into A.",
  },
  [Op.STOREP]: {
    mnemonic: "STOREP",
    hasOperand: true,
    describe: (n) => `Follow the arrow: box ${n} holds an address — copy A into THAT box.`,
    usage: "STOREP b",
    summary: "Box b holds an address — copy A into THAT box.",
  },
  [Op.CALL]: {
    mnemonic: "CALL",
    hasOperand: true,
    describe: (n) => `Remember where we are (on the stack), then jump to box ${n}.`,
    usage: "CALL a",
    summary: "Jump to box a, remembering where to come back to.",
  },
  [Op.RET]: {
    mnemonic: "RET",
    hasOperand: false,
    describe: () => "Go back to where the last CALL came from.",
    usage: "RET",
    summary: "Go back to where the last CALL came from.",
  },
  [Op.PUSH]: {
    mnemonic: "PUSH",
    hasOperand: false,
    describe: () => "Put A on top of the stack.",
    usage: "PUSH",
    summary: "Put A on top of the stack.",
  },
  [Op.POP]: {
    mnemonic: "POP",
    hasOperand: false,
    describe: () => "Take the top of the stack back into A.",
    usage: "POP",
    summary: "Take the top of the stack back into A.",
  },
  [Op.PLUSONE]: {
    mnemonic: "PLUSONE",
    hasOperand: true,
    describe: (n) => `Plus-one box ${n}; the new value also lands in A.`,
    usage: "PLUSONE b",
    summary: "Add 1 to box b; the new value also lands in A.",
  },
  [Op.MINUSONE]: {
    mnemonic: "MINUSONE",
    hasOperand: true,
    describe: (n) => `Minus-one box ${n}; the new value also lands in A.`,
    usage: "MINUSONE b",
    summary: "Subtract 1 from box b; the new value also lands in A.",
  },
  [Op.LOADB]: {
    mnemonic: "LOADB",
    hasOperand: true,
    describe: (n) => `Copy ONE byte from box ${n} into A.`,
    usage: "LOADB b",
    summary: "Copy ONE byte from box b into A.",
  },
  [Op.STOREB]: {
    mnemonic: "STOREB",
    hasOperand: true,
    describe: (n) => `Copy the low byte of A into box ${n}.`,
    usage: "STOREB b",
    summary: "Copy the low byte of A into box b.",
  },
  [Op.LOADS]: {
    mnemonic: "LOADS",
    hasOperand: true,
    describe: (n) => `Copy the word ${n} boxes above the stack pointer into A.`,
    usage: "LOADS n",
    summary: "Copy the word n boxes above the stack pointer into A.",
  },
  [Op.STORES]: {
    mnemonic: "STORES",
    hasOperand: true,
    describe: (n) => `Copy A into the word ${n} boxes above the stack pointer.`,
    usage: "STORES n",
    summary: "Copy A into the word n boxes above the stack pointer.",
  },
  [Op.LOADPB]: {
    mnemonic: "LOADPB",
    hasOperand: true,
    describe: (n) => `Follow the arrow in box ${n} and copy ONE byte from there into A.`,
    usage: "LOADPB b",
    summary: "Follow the arrow in box b and copy ONE byte from there into A.",
  },
  [Op.STOREPB]: {
    mnemonic: "STOREPB",
    hasOperand: true,
    describe: (n) => `Follow the arrow in box ${n} and copy A's low byte there.`,
    usage: "STOREPB b",
    summary: "Follow the arrow in box b and copy A's low byte there.",
  },
};

/** Decode the instruction at PC into mnemonic + plain language for the UI. */
export function decodeAt(state: VMState): {
  opcode: number;
  operand: number;
  mnemonic: string;
  text: string;
} {
  const cfg = configOf(state);
  const opcode = state.memory[state.PC];
  const operand =
    state.machine === "bb16"
      ? state.memory[(state.PC + 1) % cfg.memSize] |
        (state.memory[(state.PC + 2) % cfg.memSize] << 8)
      : state.memory[(state.PC + 1) % cfg.memSize];
  const info = OP_INFO[opcode];
  if (!info) {
    return {
      opcode,
      operand,
      mnemonic: "???",
      text: `${opcode} isn't an instruction the machine knows.`,
    };
  }
  return {
    opcode,
    operand,
    mnemonic: info.hasOperand ? `${info.mnemonic} ${operand}` : info.mnemonic,
    text: info.describe(operand),
  };
}
