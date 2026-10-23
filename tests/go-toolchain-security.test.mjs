import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const dockerfile = readFileSync(new URL('../api/Dockerfile', import.meta.url), 'utf8');
const workflow = readFileSync(new URL('../.github/workflows/api.yml', import.meta.url), 'utf8');
const goMod = readFileSync(new URL('../api/go.mod', import.meta.url), 'utf8');

const parseVersion = (version) => version.split('.').map(Number);
const atLeast = (actual, minimum) => {
  const a = parseVersion(actual);
  const b = parseVersion(minimum);
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return true;
};

function verifyToolchainPins(docker, ci, module) {
  const image = docker.match(/^FROM\s+--platform=\$BUILDPLATFORM\s+golang:(\d+\.\d+\.\d+)-alpine(\d+\.\d+)\s+AS\s+build\s*$/m);
  assert.ok(image, 'API builder must use a fully patch-pinned Go/Alpine image for BUILDPLATFORM');
  const pinnedCi = [...ci.matchAll(/^\s*go-version:\s*['"]?(\d+\.\d+\.\d+)['"]?\s*$/gm)];
  assert.equal(pinnedCi.length, 1, 'API CI must pin exactly one full Go toolchain version');
  assert.doesNotMatch(ci, /^\s*go-version-file:/m, 'Go module minimum is not a substitute for patched CI toolchain');
  assert.equal(pinnedCi[0][1], image[1], 'Docker and CI must compile with the same Go patch release');
  assert.ok(atLeast(image[1], '1.27.3'), 'security floor: Go 1.27.3 or newer required');
  const minimum = module.match(/^go\s+(\d+\.\d+(?:\.\d+)?)\s*$/m);
  assert.ok(minimum, 'api/go.mod must declare the minimum Go release');
  const minVersion = minimum[1].split('.').length === 2 ? `${minimum[1]}.0` : minimum[1];
  assert.ok(atLeast(image[1], minVersion), 'builder must not be older than module Go requirement');
}

test('Chronicles API Docker image and CI use the same supported, patched Go toolchain', () => {
  verifyToolchainPins(dockerfile, workflow, goMod);
});

test('security contract rejects CI patch drift, floating tags and unpatched 1.27.x', () => {
  assert.throws(
    () => verifyToolchainPins(dockerfile, workflow.replace("go-version: '1.27.3'", "go-version: '1.27.2'"), goMod),
    /same Go patch release/,
  );
  assert.throws(
    () => verifyToolchainPins(dockerfile.replace('golang:1.27.3-alpine3.23', 'golang:1.27-alpine'), workflow, goMod),
    /fully patch-pinned/,
  );
  assert.throws(
    () => verifyToolchainPins(
      dockerfile.replace('golang:1.27.3-alpine3.23', 'golang:1.27.2-alpine3.23'),
      workflow.replace("go-version: '1.27.3'", "go-version: '1.27.2'"),
      goMod,
    ),
    /security floor/,
  );
});

test('security contract allows deliberate matching future Go point-release upgrades', () => {
  verifyToolchainPins(
    dockerfile.replace('golang:1.27.3-alpine3.23', 'golang:1.27.4-alpine3.23'),
    workflow.replace("go-version: '1.27.3'", "go-version: '1.27.4'"),
    goMod,
  );
});

function verifiesBothCompiledGoBinaries(source) {
  const start = source.indexOf('      - name: Build and vet (amd64 + arm64)');
  const end = source.indexOf('      - name: Go vulnerability scan (reachable source paths)');
  if (start < 0 || end <= start) return false;
  const step = source.slice(start, end);
  return step.includes('export GOTOOLCHAIN=local')
    && step.includes('build_go" =~ ^go(')
    && step.includes('patch >= 3')
    && step.includes('major > 1 || (major == 1')
    && step.includes('go version -m "$binary"')
    && step.includes('GOOS=linux GOARCH=amd64 go build -o "$RUNNER_TEMP/chronicles-api"')
    && step.includes('GOOS=linux GOARCH=arm64 go build -o "$RUNNER_TEMP/chronicles-api-arm64"')
    && step.includes('[[ "$reported" == "$binary: $build_go" ]]')
    && step.includes('go version -m "$binary"')
    && step.includes("grep -Fqx $'\\tbuild\\tGOOS=linux'")
    && step.includes("grep -Fqx $'\\tbuild\\tGOARCH='")
    && step.includes('verify_binary_build "$RUNNER_TEMP/chronicles-api" amd64')
    && step.includes('verify_binary_build "$RUNNER_TEMP/chronicles-api-arm64" arm64')
    && !step.includes('|| true');
}

test('required API build inspects patched Go stdlib and binary metadata for both architectures', () => {
  assert.ok(verifiesBothCompiledGoBinaries(workflow));
});

test('binary-provenance gate rejects missing platform or compiler checks', () => {
  for (const removed of [
    'export GOTOOLCHAIN=local',
    'go version -m "$binary"',
    'verify_binary_build "$RUNNER_TEMP/chronicles-api" amd64',
    'verify_binary_build "$RUNNER_TEMP/chronicles-api-arm64" arm64',
    "grep -Fqx $'\\tbuild\\tGOARCH='",
  ]) {
    assert.equal(verifiesBothCompiledGoBinaries(workflow.replace(removed, '')), false, removed);
  }
  assert.equal(verifiesBothCompiledGoBinaries(workflow.replace('patch >= 3', 'patch >= 2')), false);
  assert.equal(verifiesBothCompiledGoBinaries(workflow.replace('major > 1 || (major == 1', 'major >= 1 || (major == 1')), false);
  assert.equal(verifiesBothCompiledGoBinaries(workflow.replace('build_go" =~ ^go(', 'build_go" == go1.27.3 || go(')), false);
});
