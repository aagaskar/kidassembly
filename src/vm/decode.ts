import { Op, VMState } from "./types";

export interface OpInfo {
  mnemonic: string;
  hasOperand: boolean;
  /** Plain-language template; `$n` is replaced with the operand. */
  describe: (operand: number) => string;
}

export const OP_INFO: Record<number, OpInfo> = {
  [Op.HALT]: {
    mnemonic: "HALT",
    hasOperand: false,
    describe: () => "Stop the machine.",
  },
  [Op.LOADC]: {
    mnemonic: "LOADC",
    hasOperand: true,
    describe: (n) => `Put the number ${n} into A.`,
  },
  [Op.LOAD]: {
    mnemonic: "LOAD",
    hasOperand: true,
    describe: (n) => `Copy what's in box ${n} into A.`,
  },
  [Op.STORE]: {
    mnemonic: "STORE",
    hasOperand: true,
    describe: (n) => `Copy A into box ${n}.`,
  },
  [Op.ADD]: {
    mnemonic: "ADD",
    hasOperand: true,
    describe: (n) => `Add the number in box ${n} to A.`,
  },
  [Op.SUB]: {
    mnemonic: "SUB",
    hasOperand: true,
    describe: (n) => `Subtract the number in box ${n} from A.`,
  },
  [Op.JUMP]: {
    mnemonic: "JUMP",
    hasOperand: true,
    describe: (n) => `Jump: the next instruction comes from box ${n}.`,
  },
  [Op.JZ]: {
    mnemonic: "JZ",
    hasOperand: true,
    describe: (n) => `If A is 0, jump to box ${n}. Otherwise keep going.`,
  },
  [Op.JNEG]: {
    mnemonic: "JNEG",
    hasOperand: true,
    describe: (n) => `If A's top bit is 1 (negative), jump to box ${n}.`,
  },
  [Op.LOADP]: {
    mnemonic: "LOADP",
    hasOperand: true,
    describe: (n) => `Follow the arrow: box ${n} holds an address — copy what's in THAT box into A.`,
  },
  [Op.STOREP]: {
    mnemonic: "STOREP",
    hasOperand: true,
    describe: (n) => `Follow the arrow: box ${n} holds an address — copy A into THAT box.`,
  },
  [Op.CALL]: {
    mnemonic: "CALL",
    hasOperand: true,
    describe: (n) => `Remember where we are (on the stack), then jump to box ${n}.`,
  },
  [Op.RET]: {
    mnemonic: "RET",
    hasOperand: false,
    describe: () => "Go back to where the last CALL came from.",
  },
  [Op.PUSH]: {
    mnemonic: "PUSH",
    hasOperand: false,
    describe: () => "Put A on top of the stack.",
  },
  [Op.POP]: {
    mnemonic: "POP",
    hasOperand: false,
    describe: () => "Take the top of the stack back into A.",
  },
  [Op.PLUSONE]: {
    mnemonic: "PLUSONE",
    hasOperand: true,
    describe: (n) => `Plus-one box ${n}; the new value also lands in A.`,
  },
  [Op.MINUSONE]: {
    mnemonic: "MINUSONE",
    hasOperand: true,
    describe: (n) => `Minus-one box ${n}; the new value also lands in A.`,
  },
};

/** Decode the instruction at PC into mnemonic + plain language for the UI. */
export function decodeAt(state: VMState): {
  opcode: number;
  operand: number;
  mnemonic: string;
  text: string;
} {
  const opcode = state.memory[state.PC];
  const operand = state.memory[(state.PC + 1) % 256];
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
