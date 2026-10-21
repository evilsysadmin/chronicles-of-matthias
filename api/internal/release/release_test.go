package release

import "testing"

func TestBuildCommitUsesPackagedSourceRevision(t *testing.T) {
    const sha = "0123456789abcdef0123456789abcdef01234567"
    getenv := func(key string) string {
        if key == "GIT_COMMIT_SHA" {
            return sha
        }
        return ""
    }
    if got := BuildCommit(getenv); got != sha {
        t.Fatalf("BuildCommit() = %q, want exact source SHA", got)
    }
    if got := DeploymentIdentity(getenv); got != "git:"+sha {
        t.Fatalf("DeploymentIdentity() = %q, want git identity", got)
    }
}

func TestBuildCommitDoesNotInventASourceRevision(t *testing.T) {
    if got := BuildCommit(func(string) string { return "" }); got != "" {
        t.Fatalf("BuildCommit() without commit metadata = %q, want empty", got)
    }
}
