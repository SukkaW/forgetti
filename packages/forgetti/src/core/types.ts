import type * as t from '@babel/types';
import type * as babel from '@babel/core';
import type {
  HookRegistration,
  ImportRegistration,
  Options,
  Preset,
} from './presets';

export type ComponentNode =
  | t.ArrowFunctionExpression
  | t.FunctionExpression
  | t.FunctionDeclaration;

export interface State extends babel.PluginPass {
  opts: Options;
}

export interface StateContext {
  imports: Map<string, t.Identifier>;
  registrations: {
    named: {
      hooks: Map<t.Identifier, HookRegistration>;
      hocs: Map<t.Identifier, ImportRegistration>;
    };
    namespace: {
      hooks: Map<t.Identifier, HookRegistration[]>;
      hocs: Map<t.Identifier, ImportRegistration[]>;
    };
  };
  preset: Preset;
  filters: {
    component: RegExp;
    hook?: RegExp;
  };
}

export interface OptimizedExpression {
  expr: t.Expression;
  deps?: t.Expression | t.Expression[];
  constant?: boolean;
}
