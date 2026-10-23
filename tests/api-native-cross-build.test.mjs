import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workflow = readFileSync(new URL('../.github/workflows/api.yml', import.meta.url), 'utf8');
const dockerfile = readFileSync(new URL('../api/Dockerfile', import.meta.url), 'utf8');

test('multi-arch Go cross-compilation needs no target-architecture emulator', () => {
  // The only build stage runs on the native builder architecture. The final
  // scratch stage does not execute a target-platform RUN instruction.
  assert.match(dockerfile, /^FROM --platform=\$BUILDPLATFORM golang:[^\n]+ AS build$/m);
  assert.match(dockerfile, /^ARG TARGETOS$/m);
  assert.match(dockerfile, /^ARG TARGETARCH$/m);
  assert.match(dockerfile, /CGO_ENABLED=0 GOOS=\$TARGETOS GOARCH=\$TARGETARCH go build/);
  assert.match(dockerfile, /^FROM scratch$/m);
  const finalStage = dockerfile.split(/^FROM scratch$/m)[1];
  assert.ok(finalStage);
  assert.doesNotMatch(finalStage, /^RUN\s/m);
  assert.match(finalStage, /COPY --from=build \/out\/chronicles-api/);
  assert.match(dockerfile, /go version -m \/out\/chronicles-api/);

  const publish = workflow.slice(workflow.indexOf('\n  publish:\n'));
  assert.match(publish, /platforms: linux\/arm64,linux\/amd64/);
  assert.match(publish, /uses: docker\/setup-buildx-action@v3/);
  assert.doesNotMatch(publish, /setup-qemu-action|binfmt|--platform=linux\/arm64\s+run/i);
  assert.match(publish, /needs: verify/);
  assert.match(publish, /push-to-registry: true/);
  assert.match(publish, /CHRONICLES_SOURCE_SHA=\$\{\{ github\.sha \}\}/);
});

test('both architecture builds remain verified before multi-arch publish', () => {
  assert.match(workflow, /CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build/);
  assert.match(workflow, /CGO_ENABLED=0 GOOS=linux GOARCH=arm64 go build/);
  assert.match(workflow, /verify_binary_build "\$RUNNER_TEMP\/chronicles-api" amd64/);
  assert.match(workflow, /verify_binary_build "\$RUNNER_TEMP\/chronicles-api-arm64" arm64/);
  assert.match(workflow, /go vet \.\/cmd\/\.\.\./);
});
