// Studio cast registry. To add an actor: create cast/<name>.js exporting
// `default function build(ctx) → { object, height, setValue(v01) }` and list it here.
import sun from './sun.js';
import house from './house.js';
import roofPanel from './roof-panel.js';
import standIn from './stand-in.js';
import powerBill from './power-bill.js';
import battery from './battery.js';
import phone from './phone.js';
import coinStack from './coin-stack.js';
import clock from './clock.js';
import gauge from './gauge.js';
import car from './car.js';
import plug from './plug.js';
import thermometer from './thermometer.js';
import calendar from './calendar.js';
import piggyBank from './piggy-bank.js';
import shoppingBag from './shopping-bag.js';
import cloud from './cloud.js';
import tree from './tree.js';
import waterDrop from './water-drop.js';
import factory from './factory.js';
import personFigure from './person-figure.js';
import documentStack from './document.js';
import scale from './scale.js';
import arrowFlow from './arrow-flow.js';
import barStack from './bar-stack.js';

export const STUDIO = {
  sun,
  house,
  'roof-panel': roofPanel,
  'stand-in': standIn,
  'power-bill': powerBill,
  battery,
  phone,
  'coin-stack': coinStack,
  clock,
  gauge,
  car,
  plug,
  thermometer,
  calendar,
  'piggy-bank': piggyBank,
  'shopping-bag': shoppingBag,
  cloud,
  tree,
  'water-drop': waterDrop,
  factory,
  'person-figure': personFigure,
  document: documentStack,
  scale,
  'arrow-flow': arrowFlow,
  'bar-stack': barStack,
};
