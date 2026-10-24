import { describe, expect, it } from 'vitest';
import { balance, customSplit, equalSplit, foodSpentByDay, light, parseEuros, plannedFoodByDay, type ExpenseLike } from '@/lib/money';
import { budget } from '@/data/trip';

const exp = (o: Partial<ExpenseLike>): ExpenseLike => ({ amountCents: 1000, paidBy: 'jesus', split: equalSplit(1000, 'jesus'), category: 'comida', day: 1, ...o });

describe('repartos', () => {
  it('a partes iguales; el céntimo impar lo pone quien paga', () => {
    expect(equalSplit(1001, 'jesus')).toEqual({ jesus: 501, lucia: 500 });
    expect(equalSplit(1001, 'lucia')).toEqual({ jesus: 500, lucia: 501 });
    expect(equalSplit(1000, 'lucia')).toEqual({ jesus: 500, lucia: 500 });
  });

  it('personalizado, sin pasarse del total', () => {
    expect(customSplit(2500, 'lucia', 1000)).toEqual({ lucia: 1000, jesus: 1500 });
    expect(customSplit(2500, 'lucia', 9999)).toEqual({ lucia: 2500, jesus: 0 });
  });

  it('lee importes en formato español', () => {
    expect(parseEuros('12,50')).toBe(1250);
    expect(parseEuros('12.5')).toBe(1250);
    expect(parseEuros('7')).toBe(700);
    expect(parseEuros('3,456')).toBeNull();
    expect(parseEuros('abc')).toBeNull();
  });
});

describe('saldo final', () => {
  it('con 3 gastos de prueba el saldo es exacto al céntimo', () => {
    const list = [
      exp({ amountCents: 2901, paidBy: 'jesus', split: equalSplit(2901, 'jesus') }), // L debe 14,50
      exp({ amountCents: 1400, paidBy: 'lucia', split: equalSplit(1400, 'lucia') }), // J debe 7,00
      exp({ amountCents: 1000, paidBy: 'jesus', split: customSplit(1000, 'lucia', 1000), category: 'otros' }), // L debe 10,00
    ];
    const b = balance(list);
    expect(b.totalCents).toBe(5301);
    expect(b.debtor).toBe('lucia');
    expect(b.amountCents).toBe(1450 - 700 + 1000);
  });

  it('las lápidas no cuentan', () => {
    expect(balance([exp({ deleted: true })]).debtor).toBeNull();
  });
});

describe('presupuesto semáforo', () => {
  it('verde, ocre hasta +10 % y vino por encima', () => {
    expect(light(1000, 1000)).toBe('green');
    expect(light(1100, 1000)).toBe('ocre');
    expect(light(1101, 1000)).toBe('vino');
  });

  it('el plan de comida sale del itinerario (230 € por persona)', () => {
    const plan = plannedFoodByDay();
    const total = Object.values(plan).reduce((a, b) => a + b, 0);
    expect(plan[2]).toBe(600 + 2900 + 2600 + 800);
    expect(total).toBe(budget.foodPlannedPPCents);
    expect(total).toBeLessThanOrEqual(budget.foodCapPPCents);
  });

  it('cuenta la parte de cada uno en comida por día', () => {
    expect(foodSpentByDay([exp({ amountCents: 1801, paidBy: 'jesus', split: equalSplit(1801, 'jesus'), day: 1 })], 'lucia')[1]).toBe(900);
  });
});
