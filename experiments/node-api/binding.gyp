{
  "targets": [
    {
      "target_name": "addon",
      "sources": [ "bridge.c" ],
      "libraries": [
          "-linterop", # Should be the same as the generated lib file
          "-L<(module_root_dir)"
      ]
    }
  ]
}