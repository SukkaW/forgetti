/* eslint-disable @typescript-eslint/no-unnecessary-condition */
import * as t from '@babel/types';
import type * as babel from '@babel/core';
import type { ComponentNode, StateContext } from './types';
import { getHookCallType } from './get-hook-call-type';
import { isPathValid } from './checks';

function isStatementValid(path: babel.NodePath): boolean {
  if (path) {
    switch (path.node.type) {
      case 'ForInStatement':
      case 'ForOfStatement':
      case 'ForStatement':
      case 'WhileStatement':
      case 'DoWhileStatement':
        return false;
      default:
        return true;
    }
  }
  return false;
}

function isInValidExpression(path: babel.NodePath): boolean {
  let current = path.parentPath;
  let prev = path;
  while (current) {
    if (
      isPathValid(current, t.isConditionalExpression)
      && (
        current.get('consequent').node === prev.node
        || current.get('alternate').node === prev.node
      )
    ) {
      return false;
    }
    if (
      isPathValid(current, t.isLogicalExpression)
      && current.get('right').node === prev.node
    ) {
      return false;
    }
    prev = current;
    current = current.parentPath;
  }
  return true;
}

export function expandExpressions(
  ctx: StateContext,
  path: babel.NodePath<ComponentNode>,
): void {
  if (path.node.type === 'ArrowFunctionExpression' && path.node.body.type !== 'BlockStatement') {
    path.node.body = t.blockStatement(
      [t.returnStatement(path.node.body)],
    );
  }
  path.traverse({
    OptionalCallExpression(p) {
      const parent = p.getFunctionParent();
      const statement = p.getStatementParent();

      if (
        parent === path
        && statement
      ) {
        const temp = p.scope.generateUidIdentifier('nullish');
        p.scope.push({
          kind: 'let',
          id: temp,
        });

        p.replaceWith(
          t.conditionalExpression(
            t.binaryExpression(
              '==',
              t.assignmentExpression('=', temp, p.node.callee),
              t.nullLiteral(),
            ),
            t.unaryExpression('void', t.numericLiteral(0)),
            t.callExpression(
              temp,
              p.node.arguments,
            ),
          ),
        );
      }
    },
    OptionalMemberExpression(p) {
      const parent = p.getFunctionParent();
      const statement = p.getStatementParent();

      if (
        parent === path
        && statement
      ) {
        const temp = p.scope.generateUidIdentifier('nullish');
        p.scope.push({
          kind: 'let',
          id: temp,
        });

        p.replaceWith(
          t.conditionalExpression(
            t.binaryExpression(
              '==',
              t.assignmentExpression('=', temp, p.node.object),
              t.nullLiteral(),
            ),
            t.unaryExpression('void', t.numericLiteral(0)),
            t.memberExpression(
              temp,
              p.node.property,
              p.node.computed,
            ),
          ),
        );
      }
    },
    AssignmentExpression(p) {
      const parent = p.getFunctionParent();
      const statement = p.getStatementParent();

      if (
        parent === path
        && statement
        && isStatementValid(statement)
        && isInValidExpression(p)
        && !isPathValid(p.parentPath, t.isStatement)
        && !isPathValid(p.parentPath, t.isVariableDeclarator)
      ) {
        const id = p.scope.generateUidIdentifier('hoisted');
        statement.insertBefore(
          t.variableDeclaration(
            'let',
            [t.variableDeclarator(id, p.node)],
          ),
        );
        p.replaceWith(id);
      }
    },
    CallExpression(p) {
      const parent = p.getFunctionParent();
      const statement = p.getStatementParent();

      if (
        parent === path
        && statement
        && !isPathValid(p.parentPath, t.isStatement)
        && !isPathValid(p.parentPath, t.isVariableDeclarator)
      ) {
        const hookType = getHookCallType(ctx, p);
        if (hookType === 'custom' || hookType === 'effect') {
          const id = p.scope.generateUidIdentifier('hoisted');
          statement.insertBefore(
            t.variableDeclaration(
              'let',
              [t.variableDeclarator(id, p.node)],
            ),
          );
          p.replaceWith(id);
        }
      }
    },
  });

  path.scope.crawl();
}
