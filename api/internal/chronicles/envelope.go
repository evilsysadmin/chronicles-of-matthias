package chronicles

import (
	"fmt"

	"go.mongodb.org/mongo-driver/v2/bson"

	"github.com/evilsysadmin/chess-studio/backend-go/internal/chroniclesmap"
)

// AreaOptions are chronicles_area_envelope's keyword arguments.
type AreaOptions struct {
	Route            *RouteSnapshot
	PlannerSnapshot  any // raw document, nil without one
	PartyLevel       *int64
	PlacementVersion int
}

// AreaEnvelope is chronicles_area_envelope.
func AreaEnvelope(mapID string, seed int64, opts AreaOptions) (bson.D, error) {
	authored, _, err := LoadManifest(mapID)
	if err != nil {
		return nil, err
	}
	proposals, err := normalizePlannerSnapshot(opts.PlannerSnapshot)
	if err != nil {
		return nil, err
	}
	var proposal any
	if p, ok := proposals[mapID]; ok {
		proposal = p
	}
	generated, mapCode, layoutRevision, err := proceduralize(authored, seed, proposal, opts.PlacementVersion)
	if err != nil {
		return nil, err
	}
	routed, err := applyRoutePlan(generated, seed, opts.Route)
	if err != nil {
		return nil, err
	}
	var difficulty bson.D
	if opts.PartyLevel != nil {
		if routed, difficulty, err = applyDifficulty(routed, *opts.PartyLevel, opts.Route.depth(mapID)); err != nil {
			return nil, err
		}
	}
	authoredID, _ := get(authored, "id").(string)
	if err := ValidateManifest(routed, authoredID); err != nil {
		return nil, err
	}
	revision, err := canonicalRevision(routed)
	if err != nil {
		return nil, err
	}
	version := get(routed, "version")
	envelope := bson.D{
		{Key: "schemaVersion", Value: int64(ManifestSchemaVersion)},
		{Key: "mapId", Value: authoredID},
		{Key: "contentVersion", Value: version},
		{Key: "seed", Value: seed},
		{Key: "instanceId", Value: sha256Hex(fmtInstance(authoredID, version, seed, revision))[:24]},
		{Key: "manifestRevision", Value: revision},
		{Key: "mapCode", Value: mapCode},
		{Key: "generatorVersion", Value: int64(chroniclesmap.GeneratorVersion)},
		{Key: "layoutRevision", Value: layoutRevision},
	}
	if difficulty != nil {
		envelope = append(envelope, bson.E{Key: "difficulty", Value: difficulty})
	}
	return append(envelope, bson.E{Key: "manifest", Value: routed}), nil
}

func fmtInstance(id string, version any, seed int64, revision string) string {
	v, _ := intValue(version)
	return fmt.Sprintf("chronicles-area-v%d:%s:%d:%d:%s", ManifestSchemaVersion, id, v, seed, revision)
}

// TransitionTargets is _transition_targets: every map a content action or an
// enemy's defeat can transition to.
func TransitionTargets(manifest bson.D) map[string]bool {
	targets := map[string]bool{}
	collect := func(rawEntries any, key string) {
		entries, _ := rawEntries.(bson.A)
		for _, rawEntry := range entries {
			entry, ok := rawEntry.(bson.D)
			if !ok {
				continue
			}
			action, _ := get(entry, key).(bson.D)
			effects, _ := get(action, "effects").(bson.A)
			for _, raw := range effects {
				if effect, ok := raw.(bson.D); ok && get(effect, "type") == "transition-map" {
					if id, isString := get(effect, "mapId").(string); isString {
						targets[id] = true
					}
				}
			}
		}
	}
	for _, group := range contentGroups {
		collect(get(manifest, group), "action")
	}
	collect(get(manifest, "enemies"), "onDefeat")
	return targets
}

