namespace auth;

entity Header {
    key ID: UUID;
}

@(requires: 'XYZ4711')
service AuthService {
  entity Header as projection on auth.Header;
}
