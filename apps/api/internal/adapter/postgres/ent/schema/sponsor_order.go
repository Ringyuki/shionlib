package schema

import (
	"entgo.io/ent"
	"entgo.io/ent/dialect/entsql"
	"entgo.io/ent/schema"
	"entgo.io/ent/schema/edge"
	"entgo.io/ent/schema/field"
	"entgo.io/ent/schema/index"
)

type SponsorOrder struct {
	ent.Schema
}

func (SponsorOrder) Annotations() []schema.Annotation {
	return []schema.Annotation{entsql.Table("sponsor_orders")}
}

func (SponsorOrder) Fields() []ent.Field {
	return []ent.Field{
		serialID(),
		field.String("provider_order_id").MaxLen(255).SchemaType(varchar(255)).Unique(),
		field.String("provider").MaxLen(50).SchemaType(varchar(50)).Default("idatariver"),
		field.String("amount").SchemaType(pg("numeric(10,2)")),
		field.String("currency").MaxLen(10).SchemaType(varchar(10)).Optional().Nillable(),
		field.String("payment_method").MaxLen(50).SchemaType(varchar(50)).Optional().Nillable(),
		field.Enum("status").Values("NEW", "DONE", "EXPIRED", "REFUND").SchemaType(pgEnum("sponsor_order_status")).Default("NEW"),
		field.String("sponsor_name").MaxLen(100).SchemaType(varchar(100)).Optional().Nillable(),
		field.Text("sponsor_message").Optional().Nillable(),
		field.Bool("is_private").Default(false),
		field.Int("user_id").SchemaType(pg("integer")).Optional().Nillable(),
		field.Time("expires_at").SchemaType(timestamp3).Optional().Nillable(),
		field.Time("paid_at").SchemaType(timestamp3).Optional().Nillable(),
		field.Bool("callback_verified").Default(false),
		created(),
		updated(),
	}
}

func (SponsorOrder) Edges() []ent.Edge {
	return []ent.Edge{
		edge.From("user", User.Type).Ref("sponsor_orders").Field("user_id").Unique(),
	}
}

func (SponsorOrder) Indexes() []ent.Index {
	return []ent.Index{
		index.Fields("status").StorageKey("sponsor_orders_status_idx"),
		index.Fields("user_id").StorageKey("sponsor_orders_user_id_idx"),
		index.Fields("created").StorageKey("sponsor_orders_created_idx"),
		index.Fields("is_private", "status", "created").StorageKey("sponsor_orders_is_private_status_created_idx"),
	}
}
